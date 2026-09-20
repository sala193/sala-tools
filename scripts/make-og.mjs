/**
 * make-og.mjs
 * ------------------------------------------------------------
 * 產生「分享連結預覽圖」（LINE、Facebook 貼連結時顯示的那張圖），1200×630：
 *   public/images/og/default.jpg   一頁式工具站（整個網站只有這一頁）
 *
 * 外觀刻意跟官網不同：深海軍藍到亮藍的漸層、LINE 綠按鈕，不用官網的金色與 logo。
 *
 * 用法：node scripts/make-og.mjs
 * 需要 sharp（Astro 已內含）與 Windows 內建的微軟正黑體（msjh.ttc / msjhbd.ttc）。
 * 圖檔已經放在專案裡，網站建置時不需要執行這支腳本；要改文字或換照片時才需要。
 * ------------------------------------------------------------
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const W = 1200, H = 630;
const FONT_BOLD = 'C:/Windows/Fonts/msjhbd.ttc';
const FONT_REG = 'C:/Windows/Fonts/msjh.ttc';

// 用 Pango 標記繪製文字（1 pt = 1 px，dpi 72）
const text = (markup, size, bold = true) =>
  sharp({
    text: {
      text: markup,
      font: `Microsoft JhengHei ${bold ? 'Bold ' : ''}${size}`,
      fontfile: bold ? FONT_BOLD : FONT_REG,
      rgba: true,
      dpi: 72,
    },
  }).png().toBuffer();
const span = (color, s) => `<span foreground="${color}">${s}</span>`;

const VARIANTS = {
  default: {
    title: '買房賣房免費工具箱',
    sub: '地圖・購屋能力・房貸・單價・房地合一稅',
  },
};

const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0E2A47"/><stop offset="0.6" stop-color="#17457F"/><stop offset="1" stop-color="#2A7DE1"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="985" cy="340" r="255" fill="#FFFFFF" fill-opacity="0.12"/>
</svg>`);

const roundRect = (w, h, r, fill) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="${fill}"/></svg>`);

// 照片：貼在右側、底部對齊
const headshot = await sharp(path.join(root, 'public/images/brand/sala-headshot.png')).resize({ height: 575 }).png().toBuffer();
const hs = await sharp(headshot).metadata();

for (const [key, v] of Object.entries(VARIANTS)) {
  const badge = await text(span('#DCEBFF', '免費・免註冊・不留個資'), 28);
  const bm = await sharp(badge).metadata();
  const tagline = await text(span('#9CC3FF', '鶯歌．鳳鳴 在地房仲　近 20 年'), 34);
  const name = await text(span('#FFFFFF', '蔡莎拉'), 120);
  const title = await text(span('#FFFFFF', v.title), 64);
  const sub = await text(span('#C9DDF5', v.sub), 32, false);
  const contact = await text(span('#FFFFFF', 'LINE：@saLa193　電話：0986-793-193'), 32);
  const cm = await sharp(contact).metadata();

  const layers = [
    { input: roundRect(bm.width + 40, bm.height + 20, 999, 'rgba(255,255,255,0.16)'), left: 64, top: 50 },
    { input: badge, left: 64 + 20, top: 50 + 10 },
    { input: tagline, left: 64, top: 165 },
    { input: name, left: 60, top: 205 },
    { input: title, left: 64, top: 372 },
    { input: sub, left: 64, top: 458 },
    { input: roundRect(cm.width + 56, 66, 33, '#06C755'), left: 64, top: 528 },
    { input: contact, left: 64 + 28, top: 528 + Math.round((66 - cm.height) / 2) },
    { input: headshot, left: W - hs.width - 70, top: H - hs.height },
  ];
  const out = path.join(root, 'public/images/og', `${key}.jpg`);
  await sharp(background).composite(layers).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
  const info = await sharp(out).metadata();
  console.log(`已輸出 ${out}（${info.width}×${info.height}）`);
}
