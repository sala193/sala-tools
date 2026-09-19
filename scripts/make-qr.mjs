/**
 * make-qr.mjs
 * ------------------------------------------------------------
 * 產生「加蔡莎拉 LINE 好友」的 QR Code（SVG），給電腦版的 LINE 視窗使用。
 * 用法：node scripts/make-qr.mjs
 * 輸出：public/images/line-qr.svg
 * ------------------------------------------------------------
 */
import QRCode from 'qrcode';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const URL_ADD_FRIEND = 'https://line.me/ti/p/@saLa193';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images', 'line-qr.svg');

const svg = await QRCode.toString(URL_ADD_FRIEND, {
  type: 'svg',
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#1A1F2B', light: '#FFFFFF' },
});
await writeFile(out, svg);
console.log('已輸出', out, '內容：', URL_ADD_FRIEND);
