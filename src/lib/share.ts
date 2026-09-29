// 「分享」「存成圖片」的共用程式：單坪價格 計算機、房屋貸款都用它。
// 蔡莎拉的聯絡方式與經紀業名稱只寫在這裡；LEGAL 要和 src/components/Footer.astro 的經紀業資訊一致。

export const SHARE_ROOT = 'https://tools.salahome.tw/';
export const AGENT = '蔡莎拉　永慶不動產　LINE：@saLa193';
export const LEGAL = [
  '永慶不動產 鶯歌建國捷運加盟店｜經紀業：廣輝不動產有限公司',
  '永慶不動產 鶯歌鳳鳴站前加盟店｜經紀業：誠輝不動產有限公司',
];
export const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (line && ctx.measureText(line + ch).width > maxW) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// 圓角矩形（不用 roundRect，舊版 LINE／手機瀏覽器沒有）
export function fillRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

export type ShareImage = {
  title: string;
  subtitle: string;
  note: string;
  bodyHeight: number;
  drawBody: (g: CanvasRenderingContext2D, top: number, width: number, pad: number) => void;
};

// 畫一張分享圖片：上面深藍標題、中間內容（drawBody 自己畫）、備註、最下面蔡莎拉聯絡方式與經紀業名稱
export function makeImage(spec: ShareImage): HTMLCanvasElement {
  const W = 720, PAD = 32, S = 2, HEAD_H = 100, FOOT_H = 150;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `400 14px ${FONT}`;
  const noteLines = wrapText(measure, spec.note, W - PAD * 2);
  const H = HEAD_H + 20 + spec.bodyHeight + 14 + noteLines.length * 22 + 18 + FOOT_H;

  const cv = document.createElement('canvas');
  cv.width = W * S;
  cv.height = H * S;
  const g = cv.getContext('2d')!;
  g.scale(S, S);
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, W, H);

  g.fillStyle = '#0E2A47';
  g.fillRect(0, 0, W, HEAD_H);
  g.textAlign = 'left';
  g.fillStyle = '#FFFFFF';
  g.font = `700 32px ${FONT}`;
  g.fillText(spec.title, PAD, 52);
  g.fillStyle = '#9CC3FF';
  g.font = `400 16px ${FONT}`;
  g.fillText(spec.subtitle, PAD, 80);

  spec.drawBody(g, HEAD_H + 20, W, PAD);

  let y = HEAD_H + 20 + spec.bodyHeight + 14;
  g.textAlign = 'left';
  g.fillStyle = '#5A6B7D';
  g.font = `400 14px ${FONT}`;
  noteLines.forEach((line, k) => g.fillText(line, PAD, y + 16 + k * 22));
  y += noteLines.length * 22 + 18;

  g.fillStyle = '#EEF3F9';
  g.fillRect(0, y, W, H - y);
  g.fillStyle = '#0E2A47';
  g.font = `700 20px ${FONT}`;
  g.fillText(AGENT, PAD, y + 40);
  g.font = `400 16px ${FONT}`;
  g.fillText('tools.salahome.tw', PAD, y + 68);
  g.fillStyle = '#5A6B7D';
  g.font = `400 13px ${FONT}`;
  LEGAL.forEach((line, k) => g.fillText(line, PAD, y + 98 + k * 20));
  return cv;
}

// 同步把畫布轉成 PNG。不用 toBlob：它要等瀏覽器有空才做，有時要等好幾秒；
// 而且手機的分享選單要在「按下去的當下」叫出來，中間不能隔太久。
export function canvasBlob(cv: HTMLCanvasElement): Blob | null {
  try {
    const bin = atob(cv.toDataURL('image/png').split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  } catch {
    return null;
  }
}

export const canvasToBlob = async (cv: HTMLCanvasElement): Promise<Blob | null> => canvasBlob(cv);

// 複製文字。host 是要放暫時輸入框的地方：在跳出視窗（dialog）裡要放進視窗，不然選不到
export async function copyText(text: string, host: HTMLElement = document.body): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    host.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed';

// 有分享選單就叫出來（先試圖片、再試文字），都沒有就複製文字
export async function shareOrCopy(o: { blob: Blob | null; text: string; title: string; filename: string; host?: HTMLElement }): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (o.blob) {
      const file = new File([o.blob], o.filename, { type: 'image/png' });
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: o.title, text: o.text });
        return 'shared';
      }
    }
    if (nav.share) {
      await nav.share({ title: o.title, text: o.text });
      return 'shared';
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return 'cancelled';
  }
  return (await copyText(o.text, o.host)) ? 'copied' : 'failed';
}

export const shareMessage = (r: ShareResult): string =>
  r === 'copied' ? '已複製文字，貼到 LINE 就能傳出去。' : r === 'failed' ? '這個瀏覽器不能自動分享，請改按「存成圖片」。' : '';
