/**
 * extract-zones.mjs
 * ------------------------------------------------------------
 * 把蔡莎拉手繪的鳳鳴重劃區地圖（底圖為國土測繪地籍圖，色塊為社區基地與各種用地）
 * 轉成地圖可用的多邊形（經緯度），輸出 src/data/fengming-zones.json。
 *
 * 做法：
 *   1. 依色塊的填色，從種子點找出同色區域（用閉運算把被文字切開的部分連起來）
 *   2. 描出外框並簡化成多邊形（單位：圖片像素）
 *   3. 用「圖上有、OpenStreetMap 也有」的社區當控制點，把像素座標對位成經緯度
 *
 * 用法：node scripts/extract-zones.mjs <手繪地圖圖檔> [--qa 疊圖輸出.png]
 * 需要 sharp（Astro 已內含）。圖檔本身不放進專案，只保留轉出的多邊形。
 * ------------------------------------------------------------
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const IMG = args[0];
const QA = args.includes('--qa') ? args[args.indexOf('--qa') + 1] : null;
if (!IMG) {
  console.error('用法：node scripts/extract-zones.mjs <手繪地圖圖檔> [--qa 疊圖.png]');
  process.exit(1);
}
const POI = path.join(__dirname, '..', 'src', 'data', 'poi-fengming.json');
const OUT = path.join(__dirname, '..', 'src', 'data', 'fengming-zones.json');

// ---------- 設定 ----------
// 用地（seeds：同一個用地可能被道路切成好幾塊，多個種子取聯集）
const PURPLE = [217, 185, 252]; // 學校用地
const ORANGE = [255, 62, 3]; // 市場、停車場、夜市
const ZONES = [
  { id: 'park-main', name: '公園用地', kind: 'park', seeds: [[960, 300], [1180, 330]], colors: [[172, 255, 172], [141, 233, 124]], r: 16 },
  { id: 'park-fengfu', name: '鳳福公園', kind: 'park', seeds: [[425, 585]], colors: [[2, 254, 2]], r: 14 },
  { id: 'park-doudoulong', name: '逗逗龍公園', kind: 'park', seeds: [[1150, 850]], colors: [[2, 254, 2]], r: 10 },
  { id: 'park-fengming', name: '鳳鳴公園', kind: 'park', seeds: [[1740, 880]], colors: [[204, 226, 155]], r: 14 },
  { id: 'school-reserved', name: '學校預訂地', kind: 'school', seeds: [[650, 440]], colors: [PURPLE], r: 16 },
  { id: 'school-primary', name: '鳳鳴國小（雙語）', kind: 'school', seeds: [[1640, 600]], colors: [PURPLE], r: 16 },
  { id: 'school-junior', name: '鳳鳴國中', kind: 'school', seeds: [[1340, 1100]], colors: [PURPLE], r: 16 },
  { id: 'commercial-land', name: '商業用地', kind: 'commercial', seeds: [[1000, 600], [1150, 560]], colors: [[248, 152, 180]], r: 16 },
  { id: 'night-market', name: '龍鳳夜市', kind: 'market', seeds: [[940, 510]], colors: [ORANGE], r: 12 },
  { id: 'commercial-zone', name: '商業區', kind: 'commercial-zone', seeds: [[1660, 1200], [1780, 1210], [1720, 1300], [1810, 1290]], colors: [[254, 0, 64]], r: 12 },
  { id: 'market-land', name: '市場用地', kind: 'market', seeds: [[1600, 1180]], colors: [ORANGE], r: 12 },
  { id: 'market-sanyuan', name: '新三沅市場', kind: 'market', seeds: [[700, 275]], colors: [ORANGE], r: 8 },
  { id: 'parking-1', name: '停車場用地', kind: 'parking', seeds: [[835, 530]], colors: [ORANGE], r: 8 },
  { id: 'gov-1', name: '機關用地', kind: 'gov', seeds: [[868, 590]], colors: [[0, 129, 253]], r: 6 },
  { id: 'gov-2', name: '機關用地', kind: 'gov', seeds: [[1195, 890]], colors: [[0, 129, 253]], r: 6 },
];

// 社區：name＝地圖上的名稱，osm＝OpenStreetMap 上的名稱（用來當控制點，沒有就填 null），px＝手繪圖上的標籤位置
const COMMUNITIES = [
  ['森聯之王森晴', '森聯之王森晴', 1380, 385], ['森聯之王森朵', '森聯之王森朵', 1375, 570], ['森聯之王森悅', '森聯之王森悅', 1467, 645],
  ['森聯之王森闊', '森聯之王森闊', 1472, 983], ['森聯之王森藏', '森聯之王森藏', 1517, 920], ['森聯LIFE森耀', '森聯LIFE森耀', 1302, 393],
  ['森聯LIFE森睦', '森聯LIFE森睦', 568, 797], ['雙捷A+', '雙捷A+', 1467, 795], ['豐邑日日', '豐邑日日', 535, 348],
  ['豐邑泱泱', '豐邑泱泱', 1515, 685], ['宏苑The One', '宏苑The One', 1267, 895], ['鳳茗HOYA', '鳳茗HOYA', 1289, 955],
  ['三發丰悅', '三發丰悦', 1514, 967], ['四季琢硯', '四季琢硯', 1497, 588], ['青松翫', '青松翫', 1270, 510],
  ['微笑海悅', '微笑海悦', 840, 685], ['微笑海悅2', '微笑海悦2', 1235, 550], ['鳳鳴尊邸', '鳳鳴尊邸', 1240, 645],
  ['鳳鳴欣苑', '鳳鳴欣苑', 650, 706], ['和耀心綻', '和耀心綻', 744, 720], ['八方喜樂', '八方喜樂', 830, 828],
  ['捷市匯', '捷市匯', 450, 863], ['丞石菁英薈3', '丞石菁英薈3', 1249, 400], ['丞石菁英薈2', '丞石菁英薈2', 825, 745],
  ['丞石菁英薈', '丞石菁英薈', 622, 830], ['京澄為德', '京澄為德', 807, 860], ['金和昌仰沐', '金和昌仰沐', 1385, 538],
  ['森鉅承', '森鉅承', 470, 790], ['新潤幸福莊園', '新潤幸福莊園', 500, 527],
  ['立瑾way', null, 517, 285], ['立瑾綠', null, 443, 290], ['僑駿響', null, 490, 415], ['幸福莊園NO2', null, 510, 470],
  ['澄果', null, 907, 883], ['合康建設', null, 993, 865], ['森聯LIFE森朗', null, 1012, 887], ['富御昕', null, 1087, 872],
  ['定泰公園翫', null, 1255, 300], ['合康', null, 1262, 605], ['梧桐莊園', null, 910, 1013], ['鶯桃小城', null, 1025, 1043],
  ['鳳鳴園', null, 1000, 1142], ['金合昌', null, 658, 838],
  ['景程禾雅', null, 947, 712], ['和瑞微美', null, 1050, 777],
];

// 圖上是建築照片或圖示、不是單色的基地，抓不到可靠範圍：不畫外框，只保留點位
const NO_PARCEL = new Set(['森聯之王森晴', '森聯之王森朵', '森聯之王森悅', '森聯之王森闊', '森聯之王森藏', '青松翫', '微笑海悅2', '金和昌仰沐', '森聯LIFE森朗', '合康建設', '鳳鳴尊邸']);
// 字很大的社區，補洞半徑要大一點
const BIG_TEXT_R = { 微笑海悅: 15, 和耀心綻: 15, 景程禾雅: 13, 和瑞微美: 13 };
// 相鄰、同色所以被抓成一塊的基地，沿交界線切開（axis：x 或 y 的像素值；小的一側→前者）
const SPLITS = [
  { seed: '幸福莊園NO2', names: ['幸福莊園NO2', '新潤幸福莊園'], axis: 'y', at: 502 },
  { seed: '丞石菁英薈3', names: ['丞石菁英薈3', '森聯LIFE森耀'], axis: 'x', at: 1277 },
];

const TOL = 30; // 顏色容許差（RGB 歐氏距離）
const CLOSE_R = 9; // 閉運算半徑（像素），要大於文字筆畫寬度、小於道路寬度
const EPS = 2.2; // 多邊形簡化門檻（像素）

// ---------- 讀圖 ----------
const { data, info } = await sharp(IMG).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, CH = info.channels;
const col = (x, y) => { const i = (y * W + x) * CH; return [data[i], data[i + 1], data[i + 2]]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// 底色（街廓米黃、道路金黃與灰、白、底圖粉）：社區自動選色時要排除，不然會漏到整個街廓
const BASE = [[254, 252, 204], [230, 196, 38], [236, 236, 236], [255, 255, 255], [226, 224, 220], [232, 233, 227]];
// 種子附近最常見的「非深色、非底色」顏色（避開黑字與線條）
function fillColor(sx, sy, r = 16) {
  const cnt = new Map();
  for (let y = sy - r; y <= sy + r; y++) for (let x = sx - r; x <= sx + r; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const c = col(x, y);
    if (c[0] + c[1] + c[2] < 200) continue;
    if (BASE.some((b) => dist(c, b) <= 24)) continue;
    const k = `${c[0] >> 4},${c[1] >> 4},${c[2] >> 4}`;
    const e = cnt.get(k) || { n: 0, s: [0, 0, 0] };
    e.n++; e.s[0] += c[0]; e.s[1] += c[1]; e.s[2] += c[2];
    cnt.set(k, e);
  }
  let best = null;
  for (const e of cnt.values()) if (!best || e.n > best.n) best = e;
  return best ? best.s.map((v) => Math.round(v / best.n)) : col(sx, sy);
}

// 在 (cx,cy) 為中心的視窗內，做「同色遮罩 → 閉運算 → 取含種子的連通區 → 補洞」
function regionAt(sx, sy, win = 300, colors = null, closeR = CLOSE_R) {
  const refs = colors || [fillColor(sx, sy)];
  const ref = refs[0];
  const x0 = Math.max(0, sx - win), y0 = Math.max(0, sy - win);
  const x1 = Math.min(W - 1, sx + win), y1 = Math.min(H - 1, sy + win);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const M = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = col(x + x0, y + y0); if (refs.some((r) => dist(c, r) <= TOL)) M[y * w + x] = 1; }
  const closed = close(M, w, h, closeR);
  // 找種子（不在遮罩上就往外找）
  let seed = -1;
  const lx = sx - x0, ly = sy - y0;
  for (let r = 0; r <= 30 && seed < 0; r++) {
    for (let dy = -r; dy <= r && seed < 0; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = lx + dx, y = ly + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (closed[y * w + x]) { seed = y * w + x; break; }
    }
  }
  if (seed < 0) return null;
  const comp = new Uint8Array(w * h);
  const st = [seed]; comp[seed] = 1;
  while (st.length) {
    const p = st.pop(); const x = p % w, y = (p / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (!comp[np] && closed[np]) { comp[np] = 1; st.push(np); }
    }
  }
  fillHoles(comp, w, h);
  return { mask: comp, w, h, x0, y0, ref };
}

// 閉運算（先膨脹再侵蝕），用累積和加速
function boxCount(M, w, h, r) {
  const S = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += M[y * w + x]; S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row; } }
  return (x, y) => {
    const xa = Math.max(0, x - r), ya = Math.max(0, y - r), xb = Math.min(w - 1, x + r), yb = Math.min(h - 1, y + r);
    return S[(yb + 1) * (w + 1) + xb + 1] - S[ya * (w + 1) + xb + 1] - S[(yb + 1) * (w + 1) + xa] + S[ya * (w + 1) + xa];
  };
}
function close(M, w, h, r) {
  const cnt = boxCount(M, w, h, r);
  const D = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) D[y * w + x] = cnt(x, y) > 0 ? 1 : 0;
  const cnt2 = boxCount(D, w, h, r);
  const E = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xa = Math.max(0, x - r), ya = Math.max(0, y - r), xb = Math.min(w - 1, x + r), yb = Math.min(h - 1, y + r);
    E[y * w + x] = cnt2(x, y) === (xb - xa + 1) * (yb - ya + 1) ? 1 : 0;
  }
  return E;
}
function fillHoles(M, w, h) {
  const out = new Uint8Array(w * h);
  const st = [];
  const push = (x, y) => { const p = y * w + x; if (!M[p] && !out[p]) { out[p] = 1; st.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) {
    const p = st.pop(); const x = p % w, y = (p / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < w * h; i++) if (!out[i]) M[i] = 1;
}

// 外框描線（Moore 鄰域）
function traceOutline(M, w, h) {
  let start = -1;
  for (let i = 0; i < w * h; i++) if (M[i]) { start = i; break; }
  if (start < 0) return [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && M[y * w + x] ? 1 : 0);
  const sx = start % w, sy = (start / w) | 0;
  const pts = [[sx, sy]];
  let x = sx, y = sy, d = 6; // 從左邊界進入
  for (let guard = 0; guard < w * h * 4; guard++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (d + 6 + k) % 8; // 從前一方向的左後方開始順時針找
      const nx = x + dirs[nd][0], ny = y + dirs[nd][1];
      if (at(nx, ny)) { x = nx; y = ny; d = nd; found = true; break; }
    }
    if (!found) break;
    if (x === sx && y === sy && pts.length > 2) break;
    pts.push([x, y]);
  }
  return pts;
}
function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const dp = (a, b) => {
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps) return [...dp(a, idx).slice(0, -1), ...dp(idx, b)];
    return [pts[a], pts[b]];
  };
  return dp(0, pts.length - 1);
}
function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
function centroid(p) { let a = 0, cx = 0, cy = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; const c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; } a /= 2; return [cx / (6 * a), cy / (6 * a)]; }

// 一個「區塊」＝多個種子區域的聯集 → 全圖座標的多邊形
function polygonFor(seeds, win, colors = null, closeR = CLOSE_R) {
  const canvas = new Uint8Array(W * H);
  let okAny = false;
  for (const [sx, sy] of seeds) {
    const r = regionAt(sx, sy, win, colors, closeR);
    if (!r) continue;
    okAny = true;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.mask[y * r.w + x]) canvas[(y + r.y0) * W + x + r.x0] = 1;
  }
  if (!okAny) return null;
  // 稍微膨脹 1 像素，補回被邊線吃掉的一半線寬
  const dil = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (canvas[y * W + x] || canvas[y * W + x - 1] || canvas[y * W + x + 1] || canvas[(y - 1) * W + x] || canvas[(y + 1) * W + x]) dil[y * W + x] = 1;
  }
  const outline = traceOutline(dil, W, H);
  const poly = simplify(outline, EPS);
  return poly.length >= 3 ? poly : null;
}

// ---------- 抽取 ----------
const zones = [];
for (const z of ZONES) {
  const poly = polygonFor(z.seeds, 420, z.colors, z.r);
  if (!poly) { console.warn(`用地「${z.name}」抓不到，略過`); continue; }
  zones.push({ ...z, px: poly });
}
const parcels = [];
const centers = new Map();
for (const [name, osm, sx, sy] of COMMUNITIES) {
  if (NO_PARCEL.has(name)) continue;
  const poly = polygonFor([[sx, sy]], 160, null, BIG_TEXT_R[name] || 7);
  if (!poly) { console.warn(`社區「${name}」抓不到基地範圍`); continue; }
  const area = polyArea(poly), [cx, cy] = centroid(poly);
  const off = Math.hypot(cx - sx, cy - sy);
  // 合理性檢查：面積要像一塊基地，重心不能離標籤太遠
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const solidity = area / ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) || 1);
  const isSplit = SPLITS.some((sp) => sp.names.includes(name)); // 合併後要再切開的，面積上限放寬
  if (area < 500 || area > (isSplit ? 30000 : 14000) || off > 70 || solidity < 0.45) { console.warn(`社區「${name}」基地範圍不合理（面積 ${Math.round(area)}px²，偏離 ${Math.round(off)}px，充滿度 ${solidity.toFixed(2)}），略過`); continue; }
  parcels.push({ name, osm, px: poly, cx, cy });
}
// 依交界線切開被抓成一塊的相鄰基地（Sutherland–Hodgman 半平面裁切）
function clip(poly, axis, at, keepLow) {
  const i = axis === 'x' ? 0 : 1;
  const inside = (p) => (keepLow ? p[i] <= at : p[i] >= at);
  const out = [];
  for (let a = 0; a < poly.length; a++) {
    const p = poly[a], q = poly[(a + 1) % poly.length];
    const pin = inside(p), qin = inside(q);
    if (pin) out.push(p);
    if (pin !== qin) { const t = (at - p[i]) / (q[i] - p[i]); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return out;
}
for (const sp of SPLITS) {
  const idx = parcels.findIndex((p) => sp.names.includes(p.name));
  if (idx < 0) { console.warn('找不到要切開的基地：' + sp.names.join('、')); continue; }
  const merged = parcels[idx].px;
  parcels.splice(idx, 1);
  sp.names.forEach((n, k) => {
    const part = clip(merged, sp.axis, sp.at, k === 0);
    if (part.length < 3) return;
    const [cx, cy] = centroid(part);
    parcels.push({ name: n, osm: COMMUNITIES.find((c) => c[0] === n)?.[1] ?? null, px: part, cx, cy });
  });
}
console.log(`用地 ${zones.length}/${ZONES.length}，社區基地 ${parcels.length}/${COMMUNITIES.length}`);

// ---------- 對位（像素 → 經緯度）----------
const poi = JSON.parse(await readFile(POI, 'utf8'));
const byName = Object.fromEntries(poi.points.filter((p) => p.cat === 'community').map((p) => [p.name, p]));
const C = poi.center, R = 6371000, k = Math.cos((C.lat * Math.PI) / 180);
const toM = (lat, lng) => [((lng - C.lng) * Math.PI / 180) * R * k, ((lat - C.lat) * Math.PI / 180) * R];
const toLL = (X, Y) => [C.lat + (Y / R) * 180 / Math.PI, C.lng + (X / (R * k)) * 180 / Math.PI];
function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < 3; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= 3; c++) M[r][c] -= f * M[i][c]; }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { let s = M[i][3]; for (let c = i + 1; c < 3; c++) s -= M[i][c] * x[c]; x[i] = s / M[i][i]; }
  return x;
}
function fit(pts) {
  const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Ax = [0, 0, 0], Ay = [0, 0, 0];
  for (const p of pts) {
    const [X, Y] = toM(p.lat, p.lng), r = [p.cx, p.cy, 1];
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) AtA[i][j] += r[i] * r[j]; Ax[i] += r[i] * X; Ay[i] += r[i] * Y; }
  }
  return { ax: solve3(AtA, Ax), ay: solve3(AtA, Ay) };
}
const apply = (m, px, py) => [m.ax[0] * px + m.ax[1] * py + m.ax[2], m.ay[0] * px + m.ay[1] * py + m.ay[2]];
let ctrl = parcels.filter((p) => p.osm && byName[p.osm]).map((p) => ({ ...p, lat: byName[p.osm].lat, lng: byName[p.osm].lng }));
let model;
for (let it = 0; it < 8; it++) {
  model = fit(ctrl);
  const res = ctrl.map((p) => { const [X, Y] = apply(model, p.cx, p.cy), [tx, ty] = toM(p.lat, p.lng); return { p, e: Math.hypot(X - tx, Y - ty) }; }).sort((a, b) => b.e - a.e);
  const rms = Math.sqrt(res.reduce((s, r) => s + r.e * r.e, 0) / res.length);
  console.log(`對位第 ${it} 輪：控制點 ${ctrl.length}，RMS ${rms.toFixed(1)} m，最大 ${res[0].p.name} ${res[0].e.toFixed(1)} m`);
  if (res[0].e > 35 && ctrl.length > 12) ctrl = ctrl.filter((p) => p !== res[0].p); else break;
}
const toLatLng = (poly) => poly.map(([px, py]) => { const [X, Y] = apply(model, px, py); const [lat, lng] = toLL(X, Y); return [+lat.toFixed(6), +lng.toFixed(6)]; });
const areaM2 = (poly) => {
  const m = poly.map(([px, py]) => apply(model, px, py));
  let a = 0; for (let i = 0; i < m.length; i++) { const [x1, y1] = m[i], [x2, y2] = m[(i + 1) % m.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
};

const result = {
  _說明: '由蔡莎拉手繪地圖（底圖為國土測繪地籍圖）以色塊自動描出外框後對位轉成經緯度，誤差約 10～30 公尺。重新產生：node scripts/extract-zones.mjs <圖檔>',
  zones: zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, polygon: toLatLng(z.px), areaM2: Math.round(areaM2(z.px)) })).filter((z) => z.areaM2 >= 300),
  parcels: parcels.map((p) => ({ name: p.name, polygon: toLatLng(p.px), areaM2: Math.round(areaM2(p.px)) })),
};
await writeFile(OUT, JSON.stringify(result));
console.log('已輸出', OUT, `（${zones.length} 用地、${parcels.length} 社區基地）`);
console.log('用地面積（m²）：', result.zones.map((z) => `${z.name} ${z.areaM2}`).join('、'));

// ---------- 疊圖檢查 ----------
if (QA) {
  const colors = ['#e6194b', '#3cb44b', '#0082c8', '#f58231', '#911eb4', '#008080', '#aa6e28', '#800000', '#000075'];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  zones.forEach((z, i) => {
    svg += `<polygon points="${z.px.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="5"/><polygon points="${z.px.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${colors[i % 9]}" stroke-width="3"/>`;
    const [cx, cy] = centroid(z.px);
    svg += `<text x="${cx}" y="${cy}" font-size="22" font-family="Arial" fill="#000" stroke="#fff" stroke-width="4" paint-order="stroke" text-anchor="middle">Z${i + 1}</text>`;
  });
  parcels.forEach((p, i) => {
    svg += `<polygon points="${p.px.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="4"/><polygon points="${p.px.map((q) => q.join(',')).join(' ')}" fill="none" stroke="${colors[(i + 3) % 9]}" stroke-width="2"/>`;
    svg += `<text x="${p.cx}" y="${p.cy}" font-size="15" font-family="Arial" fill="#000" stroke="#fff" stroke-width="3" paint-order="stroke" text-anchor="middle">${i + 1}</text>`;
  });
  svg += '</svg>';
  await sharp(IMG).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(QA);
  console.log('疊圖：', QA);
  console.log('用地編號：', zones.map((z, i) => `Z${i + 1}=${z.name}`).join('、'));
  console.log('社區編號：', parcels.map((p, i) => `${i + 1}=${p.name}`).join('、'));
}

// ---------- 回寫社區座標 ----------
// community-info.json 裡「手繪圖新增」的社區，用基地外框的中心（沒有外框就用標籤像素位置）重新換算座標
{
  const infoPath = path.join(__dirname, '..', 'src', 'data', 'community-info.json');
  const info = JSON.parse(await readFile(infoPath, 'utf8'));
  let n = 0;
  for (const a of info.added) {
    if (!a.px) continue;
    const parcel = parcels.find((p) => p.name === a.name);
    const [px, py] = parcel ? [parcel.cx, parcel.cy] : a.px;
    const [X, Y] = apply(model, px, py), [lat, lng] = toLL(X, Y);
    a.lat = +lat.toFixed(6);
    a.lng = +lng.toFixed(6);
    n++;
  }
  await writeFile(infoPath, JSON.stringify(info, null, 2) + '\n');
  console.log(`已用基地外框中心更新 ${n} 個新增社區的座標`);
}
