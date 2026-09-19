/**
 * fetch-poi.mjs
 * ------------------------------------------------------------
 * 抓取鳳鳴重劃區周邊的生活機能點位，整理成 src/data/poi-fengming.json，
 * 給 /map（鳳鳴重劃區生活地圖）在建置時讀取。
 *
 * 資料來源：
 *   - OpenStreetMap 貢獻者（透過 Overpass API，ODbL 授權）：
 *     火車站／捷運站、公車站牌、交流道、學校、幼兒園
 *   - YouBike（微笑單車）官方公開站點資料：站名、地址、車柱數
 *
 * 用法：node scripts/fetch-poi.mjs
 * 不需要額外安裝套件（Node 18+ 內建 fetch）。
 *
 * 之後要新增類別（醫院、超市、公園…）：在 QUERY 加一行 Overpass 條件，
 * 再到 build() 加對應的整理規則即可。
 * ------------------------------------------------------------
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '..', 'src', 'data', 'poi-fengming.json');

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

async function overpass() {
  let lastErr;
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(QUERY),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.elements)) throw new Error('回傳格式不符');
      return json;
    } catch (e) {
      lastErr = e;
      console.warn(`Overpass ${ep} 失敗：${e.message}`);
    }
  }
  throw lastErr;
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

const points = [
  ...buildRail(els),
  ...buildBus(els),
  ...buildJunction(els),
  ...bikes,
  ...buildSchool(els),
].map((p) => ({ ...p, d: Math.round(dFromCenter(p.lat, p.lng)) }));

points.sort((a, b) => a.d - b.d);

const summary = points.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {});

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString().slice(0, 10),
      center: CENTER,
      sources: {
        osm: 'OpenStreetMap 貢獻者（ODbL）',
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
