/**
 * fetch-poi.mjs
 * ------------------------------------------------------------
 * 抓取鳳鳴重劃區周邊的生活機能點位，整理成 src/data/poi-fengming.json，
 * 給 /map（鳳鳴重劃區生活地圖）在建置時讀取。
 *
 * 資料來源：
 *   - OpenStreetMap 貢獻者（透過 Overpass API，ODbL 授權）：
 *     火車站／捷運站、社區與新建案、公車站牌、交流道、學校、幼兒園
 *   - YouBike（微笑單車）官方公開站點資料：站名、地址、車柱數
 *
 * 用法：node scripts/fetch-poi.mjs
 * 不需要額外安裝套件（Node 18+ 內建 fetch）。
 *
 * 之後要新增類別（醫院、超市、公園…）：在 QUERY 加一行 Overpass 條件，
 * 再到 build() 加對應的整理規則即可。
 * ------------------------------------------------------------
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '..', 'src', 'data', 'poi-fengming.json');
// 蔡莎拉手繪地圖整理出的社區戶數與補充社區（見檔案內說明）
const COMMUNITY_INFO = path.join(__dirname, '..', 'src', 'data', 'community-info.json');
// 社區詳細資料：完工日期、樓高、基地坪數、公設比、車位…（見檔案內說明）
const COMMUNITY_DETAILS = path.join(__dirname, '..', 'src', 'data', 'community-details.json');
// 手繪地圖上的賣場、餐飲、便利商店（位置由 extract-zones.mjs 依手繪圖換算）
const HAND_SHOPS = path.join(__dirname, '..', 'src', 'data', 'hand-shops.json');

// 地圖中心：台鐵鳳鳴站（OpenStreetMap 車站節點座標）
const CENTER = { lat: 24.9724968, lng: 121.3367973, name: '鳳鳴火車站' };

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'sala-tools-poi/1.0 (https://tools.salahome.tw; sala793193@gmail.com)';

const around = (r) => `(around:${r},${CENTER.lat},${CENTER.lng})`;
const QUERY = `[out:json][timeout:90];
(
  nwr["railway"~"^(station|halt)$"]${around(6000)};
  nwr["highway"="bus_stop"]${around(3000)};
  nwr["amenity"="school"]${around(3200)};
  nwr["amenity"="kindergarten"]${around(3000)};
  node["highway"="motorway_junction"]${around(8000)};
  nwr["building"~"^(apartments|residential)$"]["name"]${around(2600)};
  nwr["landuse"="residential"]["name"]${around(2600)};
  nwr["landuse"="construction"]["construction"="residential"]["name"]${around(2600)};
);
out center tags;`;

// ---------- 工具 ----------
function distance(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const t = (x) => (x * Math.PI) / 180;
  const h =
    Math.sin(t(bLat - aLat) / 2) ** 2 +
    Math.cos(t(aLat)) * Math.cos(t(bLat)) * Math.sin(t(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const dFromCenter = (lat, lng) => distance(CENTER.lat, CENTER.lng, lat, lng);
const pos = (el) => ({ lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon });
const round6 = (n) => Math.round(n * 1e6) / 1e6;

// 伺服器忙碌或備援伺服器回傳不完整時，寧可失敗也不要寫出壞資料：
// 結果太少（鳳鳴周邊正常會有 800 筆以上）就視為失敗，並重試
const MIN_ELEMENTS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function overpass() {
  let lastErr;
  for (let round = 0; round < 3; round++) {
    for (const ep of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(QUERY),
          signal: AbortSignal.timeout(150000), // 伺服器不回應就放棄這一台，換下一台
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json.elements)) throw new Error('回傳格式不符');
        if (json.elements.length < MIN_ELEMENTS) throw new Error(`只回傳 ${json.elements.length} 筆，資料不完整`);
        return json;
      } catch (e) {
        lastErr = e;
        console.warn(`Overpass ${ep} 失敗：${e.message}`);
      }
    }
    if (round < 2) {
      console.warn('等 20 秒後重試…');
      await sleep(20000);
    }
  }
  throw new Error(`Overpass 全部失敗，未更新資料檔：${lastErr?.message}`);
}

// ---------- 各類別整理 ----------
function buildRail(els) {
  const out = [];
  for (const el of els) {
    const t = el.tags || {};
    if (!/^(station|halt)$/.test(t.railway || '') || !t.name) continue;
    const { lat, lng } = pos(el);
    const network = t.network || '';
    const sub = /臺鐵|台鐵|鐵路/.test(network) ? '台鐵' : /新北捷運/.test(network) ? '三鶯線捷運' : '捷運/輕軌';
    const name = /站$/.test(t.name) ? t.name : `${t.name}站`;
    out.push({ id: `rail-${el.id}`, cat: 'rail', sub, name, lat: round6(lat), lng: round6(lng) });
  }
  return out;
}

// 同名、100 公尺內的站牌合併成一個點（去程／回程視為同一站）
function buildBus(els) {
  const stops = els
    .filter((el) => el.tags?.highway === 'bus_stop' && el.tags.name)
    .map((el) => ({ ...pos(el), name: el.tags.name, ops: el.tags.operator ? [el.tags.operator] : [] }))
    .sort((a, b) => dFromCenter(a.lat, a.lng) - dFromCenter(b.lat, b.lng));
  const clusters = [];
  for (const s of stops) {
    const hit = clusters.find((c) => c.name === s.name && distance(c.lat, c.lng, s.lat, s.lng) <= 100);
    if (hit) {
      hit.count += 1;
      for (const o of s.ops) if (!hit.ops.includes(o)) hit.ops.push(o);
    } else {
      clusters.push({ name: s.name, lat: s.lat, lng: s.lng, count: 1, ops: [...s.ops] });
    }
  }
  return clusters.map((c, i) => ({
    id: `bus-${i}`,
    cat: 'bus',
    sub: '公車站',
    name: c.name,
    lat: round6(c.lat),
    lng: round6(c.lng),
    count: c.count,
    ops: c.ops,
  }));
}

// 同名交流道只留距離最近的一個節點（每個出入口匝道都是一個節點）
function buildJunction(els) {
  const best = new Map();
  for (const el of els) {
    if (el.tags?.highway !== 'motorway_junction' || !el.tags.name) continue;
    const { lat, lng } = pos(el);
    const d = dFromCenter(lat, lng);
    const cur = best.get(el.tags.name);
    if (!cur || d < cur.d) best.set(el.tags.name, { d, el, lat, lng });
  }
  return [...best.values()].map(({ el, lat, lng }) => ({
    id: `junction-${el.id}`,
    cat: 'junction',
    sub: '交流道',
    name: el.tags.name,
    lat: round6(lat),
    lng: round6(lng),
    ref: el.tags.ref || '',
  }));
}

// 社區：OSM 上同一個社區常有「住宅用地範圍」加上好幾棟「建築物」，同名合併成一個點。
// 位置優先用住宅用地範圍的中心，沒有就取各棟建築的平均位置。
// 施工中的住宅用地（landuse=construction）視為「新建案」。
const NOT_COMMUNITY = /重劃區|宿舍|工業區|園區|建設工地|建設建案|營造|公司/;
// 施工中的項目常標成「○○建案工地」，去掉後綴才是建案名稱
const cleanName = (n) => n.replace(/\s*(建案)?工地$/, '').trim();
function buildCommunity(els) {
  const groups = new Map();
  for (const el of els) {
    const t = el.tags || {};
    const name = cleanName((t.name || '').trim());
    if (!name || NOT_COMMUNITY.test(name)) continue;
    const isConstruction = t.landuse === 'construction';
    const isArea = t.landuse === 'residential';
    const isBuilding = /^(apartments|residential)$/.test(t.building || '');
    if (!isConstruction && !isArea && !isBuilding) continue;
    const g = groups.get(name) || { name, construction: false, area: null, buildings: [], levels: 0, addr: '' };
    const p = pos(el);
    if (isConstruction) {
      g.construction = true;
      g.area = g.area || p;
    } else if (isArea) {
      g.area = p;
    } else {
      g.buildings.push(p);
      g.levels = Math.max(g.levels, Number(t['building:levels']) || 0);
    }
    g.addr = g.addr || t['addr:full'] || '';
    groups.set(name, g);
  }
  const out = [];
  for (const g of groups.values()) {
    let p = g.area;
    if (!p && g.buildings.length) {
      p = {
        lat: g.buildings.reduce((s, b) => s + b.lat, 0) / g.buildings.length,
        lng: g.buildings.reduce((s, b) => s + b.lng, 0) / g.buildings.length,
      };
    }
    if (!p) continue;
    out.push({
      id: `community-${out.length}`,
      cat: 'community',
      sub: g.construction && !g.buildings.length ? '新建案' : '社區',
      name: g.name,
      lat: round6(p.lat),
      lng: round6(p.lng),
      buildings: g.buildings.length,
      levels: g.levels || undefined,
      address: g.addr || undefined,
    });
  }
  return out;
}

// OSM 沒有學校層級標籤，依校名判斷
function schoolLevel(name) {
  if (/特殊教育/.test(name)) return '特教';
  if (/國小|國民小學/.test(name)) return '國小';
  if (/國中|國民中學/.test(name)) return '國中';
  if (/高中|高級中學|高職|高級職業|工商|商工|農工|工農|家商|實驗/.test(name)) return '高中職';
  if (/大學|學院/.test(name)) return '大學';
  return '學校';
}
function buildSchool(els) {
  const out = [];
  for (const el of els) {
    const t = el.tags || {};
    if (!t.name) continue;
    const { lat, lng } = pos(el);
    if (t.amenity === 'school') {
      out.push({ id: `school-${el.id}`, cat: 'school', sub: schoolLevel(t.name), name: t.name, lat: round6(lat), lng: round6(lng) });
    } else if (t.amenity === 'kindergarten') {
      out.push({ id: `school-${el.id}`, cat: 'school', sub: '幼兒園', name: t.name, lat: round6(lat), lng: round6(lng) });
    }
  }
  return out;
}

// YouBike 官方站點：只留營運中（status=1）且在半徑內的站
async function buildBike() {
  const res = await fetch('https://apis.youbike.com.tw/json/station-yb2.json', { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`YouBike API HTTP ${res.status}`);
  const all = await res.json();
  return all
    .filter((s) => Number(s.status) === 1 && dFromCenter(Number(s.lat), Number(s.lng)) <= 3000)
    .map((s) => ({
      id: `bike-${s.station_no}`,
      cat: 'bike',
      sub: 'YouBike 2.0',
      name: String(s.name_tw).replace(/^YouBike2\.0_/, ''),
      lat: round6(Number(s.lat)),
      lng: round6(Number(s.lng)),
      address: `${s.district_tw || ''}${s.address_tw || ''}`,
      capacity: Number(s.parking_spaces) || 0,
    }));
}

// ---------- 主程式 ----------
const [raw, bikes] = await Promise.all([overpass(), buildBike()]);
const els = raw.elements;

const merged = [
  ...buildRail(els),
  ...buildCommunity(els),
  ...buildBus(els),
  ...buildJunction(els),
  ...bikes,
  ...buildSchool(els),
];

// 套用手繪地圖的社區資料：OSM 已有的補戶數，OSM 沒有的新增（位置為手繪圖換算的概略位置）
const info = JSON.parse(await readFile(COMMUNITY_INFO, 'utf8'));
for (const e of info.matched) {
  const p = merged.find((x) => x.cat === 'community' && x.name === e.osm);
  if (!p) {
    console.warn(`手繪圖社區「${e.label}」在 OSM 資料中找不到「${e.osm}」，略過`);
    continue;
  }
  p.households = e.households;
  if (e.householdsNote) p.householdsNote = e.householdsNote;
  if (e.name) {
    p.osmName = p.name; // 保留 OSM 原名，對位與除錯時用
    p.name = e.name;
  }
}
info.added.forEach((a, i) => {
  if (merged.some((x) => x.cat === 'community' && x.name === a.name)) {
    console.warn(`手繪圖社區「${a.name}」已存在於 OSM 資料，略過新增`);
    return;
  }
  merged.push({
    id: `community-hand-${i}`,
    cat: 'community',
    sub: '社區',
    name: a.name,
    lat: a.lat,
    lng: a.lng,
    households: a.households ?? undefined,
    householdsNote: a.householdsNote ?? undefined,
    approx: true,
  });
});

// 手繪地圖上的商店（賣場、餐飲、便利商店），標示「營業中」或「預定地」
const handShops = JSON.parse(await readFile(HAND_SHOPS, 'utf8'));
handShops.shops.forEach((sh, i) => {
  if (!sh.lat || !sh.lng) {
    console.warn(`商店「${sh.name}」還沒有座標，請先執行 node scripts/extract-zones.mjs，略過`);
    return;
  }
  merged.push({
    id: `shop-${i}`,
    cat: 'shop',
    sub: sh.sub,
    name: sh.name,
    lat: sh.lat,
    lng: sh.lng,
    status: sh.status,
    note: sh.note || undefined,
    address: sh.addr || undefined,
    source: sh.source || undefined,
    logo: sh.logo ? `/images/logos/${sh.logo}.png` : undefined,
    photo: sh.photo ? `/images/shops/${sh.photo}.jpg` : undefined,
    photoNote: sh.photo ? sh.photoNote || undefined : undefined,
    // 只有依手繪圖換算的（有 px）才是概略位置；Google 地圖查到的是店家實際座標
    approx: sh.px ? true : undefined,
  });
});

// 套用社區詳細資料（完工日期、樓高等）
const details = JSON.parse(await readFile(COMMUNITY_DETAILS, 'utf8'));
for (const [name, d] of Object.entries(details)) {
  if (name.startsWith('_')) continue;
  const p = merged.find((x) => x.cat === 'community' && x.name === name);
  if (!p) {
    console.warn(`社區詳細資料「${name}」在地圖資料中找不到同名社區，略過`);
    continue;
  }
  Object.assign(p, d);
}

const points = merged.map((p) => ({ ...p, d: Math.round(dFromCenter(p.lat, p.lng)) }));

points.sort((a, b) => a.d - b.d);

const summary = points.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {});

// 備援伺服器偶爾會回傳「筆數夠多但缺一大塊」的資料（曾出現社區少 20 個、找不到森闊／森藏）。
// 和上一次的結果比，任何一類少超過 15% 就不寫檔；確定是 OSM 真的刪了資料才加 --force
if (!process.argv.includes('--force')) {
  let prev = null;
  try {
    prev = JSON.parse(await readFile(OUTPUT, 'utf8')).points;
  } catch {}
  if (prev) {
    const before = prev.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {});
    const bad = Object.entries(before).filter(([cat, n]) => n >= 10 && (summary[cat] || 0) < n * 0.85);
    if (bad.length) {
      console.error(
        `資料比上次少太多，疑似 Overpass 回傳不完整，未更新資料檔：` +
          bad.map(([cat, n]) => `${cat} ${n} → ${summary[cat] || 0}`).join('、') +
          '（稍後重跑；確定要以新資料為準請加 --force）',
      );
      process.exit(1);
    }
  }
}

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString().slice(0, 10),
      center: CENTER,
      sources: {
        osm: 'OpenStreetMap 貢獻者（ODbL）',
        hand: '蔡莎拉手繪鳳鳴重劃區地圖（社區戶數與補充社區）',
        youbike: 'YouBike 微笑單車官方公開站點資料',
      },
      points,
    },
    null,
    0,
  ),
);
console.log('完成：', OUTPUT);
console.log('各類別數量：', summary);
