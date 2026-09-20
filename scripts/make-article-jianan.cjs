/**
 * make-article-jianan.cjs
 * ------------------------------------------------------------
 * 由地圖資料（src/data/poi-fengming.json）產生官網文章「鳳鳴重劃區建案整理」，
 * 輸出到同層資料夾的 test-site 專案：src/content/articles/fengming-jianan-tong-jianshang.md
 * 表格與數字全部取自資料，和地圖一致，避免手抄錯。
 *
 * 用法（在 sala-tools 專案根目錄）：node scripts/make-article-jianan.cjs
 * 產生後到 test-site 看過內容，再照文章流程提交、預覽、上線。
 * 文章版面（本文重點、金句、關鍵數字卡、行動卡、常見問題、資料來源、延伸閱讀）欄位與寫法見
 * test-site/src/content/articles/_文章模板.md
 * ------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');

const poi = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'poi-fengming.json'), 'utf8')).points.filter((p) => p.cat === 'community');
const by = Object.fromEntries(poi.map((p) => [p.name, p]));
const TODAY = new Date();
const todayIso = TODAY.toISOString().slice(0, 10);
const OUT = path.join(__dirname, '..', '..', 'test-site', 'src', 'content', 'articles', 'fengming-jianan-tong-jianshang.md');

const SHOW = {
  新潤幸福莊園: '新潤幸福莊園（一期）', 幸福莊園NO2: '新潤幸福莊園（二期）',
  丞石菁英薈: '丞石菁英薈（一期）', 丞石菁英薈2: '丞石菁英薈（二期）', 丞石菁英薈3: '丞石菁英薈（三期，THE QUEEN）',
  微笑海悅: '微笑海悅（一期）', 微笑海悅2: '微笑海悅 2', 立瑾way: '立瑾 WAY', '宏苑The One': '宏苑 THE ONE',
};
const nm = (n) => SHOW[n] || n;
const N = (x) => x.toLocaleString('en-US');

function done(c) {
  let m = /^(\d{4})-Q([1-4])$/.exec(c || '');
  if (m) { const y = +m[1], q = +m[2]; return { text: `民國 ${y - 1911} 年第 ${q} 季`, done: new Date(y, q * 3, 0) <= TODAY }; }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c || '');
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return { text: `民國 ${+m[1] - 1911} 年 ${+m[2]} 月`, done: d <= TODAY }; }
  return null;
}
const hh = (p) => (p.households ? `${p.households}${p.householdsNote ? `（${p.householdsNote}）` : ''}` : '—');
const fl = (p) => (p.floorsUp ? `${p.floorsUp} 層` : p.buildingType || '—');
const st = (p) => { const c = done(p.completion); return c ? (c.done ? `已完工（${c.text}）` : `預計${c.text}完工`) : '—'; };

function table(names) {
  const rows = names.map((n) => {
    const p = by[n];
    if (!p) throw new Error('找不到 ' + n);
    return `| ${nm(n)} | ${hh(p)} | ${fl(p)} | ${st(p)} |`;
  });
  return ['| 案名 | 戶數 | 地上樓高 | 完工 |', '|---|---|---|---|', ...rows].join('\n');
}
const total = (names) => names.reduce((s, n) => s + (by[n].households || 0), 0);

const groups = [
  {
    title: '森聯：8 案、784 戶，鳳鳴最大的一組',
    names: ['森朗', '森晴', '森朵', '森悅', '森闊', '森藏', '森耀', '森睦'],
    intro:
      '森聯在鳳鳴一共 8 案、784 戶，案名都有一個「森」字。這 8 案實際起造的建設公司名稱不太一樣（PLEX 上可以看到文森、永聯、森寶等），對外都是「森聯」這個品牌。' +
      '想看它們在地圖上的位置，可以直接打開[只看森聯 8 案的地圖](https://tools.salahome.tw/?show=森聯)；森晴我另外寫過[開箱文](/communities/senqing)。',
    after:
      '另外，**森鉅承**（森鉅建設，森聯機構）不在上面這 8 案裡，它是後來的案子：' +
      `${by['森鉅承'].households} 戶、地上 ${by['森鉅承'].floorsUp} 層，${st(by['森鉅承'])}。`,
  },
  {
    title: '豐邑機構：2 案',
    names: ['豐邑泱泱', '豐邑日日'],
    intro: '豐邑泱泱的建商是浩瀚開發建設，豐邑日日是佳成建設，兩家都標為豐邑機構。',
  },
  {
    title: '丞石建築：菁英薈一、二、三期',
    names: ['丞石菁英薈', '丞石菁英薈2', '丞石菁英薈3'],
    intro: '同一個建商連續推了三期，位置分散在鳳七路、龍三路、龍五路。三期放在一起，可以看同一個建商前後幾年的規劃和樓高有什麼變化。',
  },
  {
    title: '新潤建設：幸福莊園一、二期',
    names: ['新潤幸福莊園', '幸福莊園NO2'],
    intro: '兩期在鳳福路上，一期完工較早，二期接著推出，戶數都在兩百多戶。',
  },
  {
    title: '京澄建設：兩塊基地、兩個案子',
    names: ['京澄為德', '京澄為泰'],
    intro:
      '同一個建商在鳳七路、龍三路口有兩塊基地，推兩個案子：**京澄為德先賣，京澄為泰後推**。' +
      '兩案規劃很接近（公開資料上都是兩棟、地上 14 層、各 113 戶），差別在推出時間；要買的話，兩案要分開比較。',
  },
  {
    title: '定泰建設：2 案',
    names: ['定泰公園翫', '青松翫'],
    intro: '定泰公園翫在龍五路，青松翫在鳳三路，兩案都是定泰建設。',
  },
  {
    title: '悅大建設（海悅團隊）：微笑海悅 1、2',
    names: ['微笑海悅', '微笑海悅2'],
    intro: '微笑海悅一期在鳳鳴路，二期在龍五路、規模較小，是同一建商前後推出的兩案。',
  },
  {
    title: '新月建設：富御昕與鳴日之城',
    names: ['富御昕', '鳴日之城-日安', '鳴日之城-日禾'],
    intro: '富御昕在鳳五路，已完工；鳴日之城日安、日禾在鶯桃路二段一帶，是還在預售、完工時間較遠的兩案。',
  },
  {
    title: '立瑾建設：立瑾 WAY 與立瑾綻',
    names: ['立瑾way', '立瑾綻'],
    intro: '立瑾 WAY 是大樓，立瑾綻是 10 戶的電梯透天，兩案都在鳳吉一街一帶，產品型態差很多。',
  },
];

const singles = [
  ['雙捷A+', '和發建設'], ['和瑞微美', '和瑞建設'], ['和耀心綻', '和耀建設'], ['四季琢硯', '合硯建設'], ['捷市匯', '寶誠建設'], ['鳳茗HOYA', '協和建設'], ['合康世紀滙', '合康建設'],
  ['景程禾雅', '景程建設（國鉅機構）'], ['八方喜樂', '盈寶建設（鑫寶機構）'], ['三發丰悅', '三發地產'], ['鳳鳴尊邸', '瑞駿建設'],
  ['鳳鳴欣苑', '台欣建設（建豐機構）'], ['僑駿響', '僑駿建設'], ['宏苑The One', '宏瑋基建設'], ['金和昌仰沐', '金和昌建設'],
  ['京懋明日和', '京懋建築（聯京建設）'], ['豐億梧桐院', '豐億開發'],
];

const usedNames = new Set(groups.flatMap((g) => g.names).concat(singles.map((s) => s[0]), ['森鉅承']));
const totalCases = usedNames.size;
const grandTotal = [...usedNames].reduce((s, n) => s + (by[n].households || 0), 0);
const unfinished = [...usedNames].map((n) => by[n]).filter((p) => { const c = done(p.completion); return c && !c.done; }).sort((a, b) => a.completion.localeCompare(b.completion));
const senlian = groups[0];
const senlianTotal = total(senlian.names);

// ---------------- 前言（frontmatter）----------------
const fm = {
  title: '鳳鳴重劃區建案整理：同建商的案子一次看',
  seo_title: '鳳鳴重劃區建案整理｜依建商看戶數、樓高、完工時間',
  subtitle: `${totalCases} 個案子、約 ${N(grandTotal)} 戶；森聯 8 案共 ${senlianTotal} 戶，是鳳鳴最大的一組。`,
  description: `把鳳鳴重劃區的建案依建商整理：森聯 8 案 ${senlianTotal} 戶、京澄為德先賣為泰後推，戶數、樓高、完工時間一張表看完。`,
  region: '鳳鳴',
  category: '買房',
  author: '蔡莎拉',
  date: '2026-09-19',
  updated: todayIso,
  tags: ['鳳鳴重劃區', '建案', '建商', '森聯', '新建案'],
  tldr: [
    `<b>整理了 ${totalCases} 個案子、約 ${N(grandTotal)} 戶</b>，依建商分組，戶數、樓高、完工時間一張表看完。`,
    `<b>森聯 8 案共 ${senlianTotal} 戶</b>是最大的一組；森鉅承（森鉅建設，森聯機構）是後來的案子，另計。`,
    '<b>京澄為德先賣、京澄為泰後推</b>：同一個建商、兩塊基地、兩個案子，要分開比較。',
    `<b>還沒完工的有 ${unfinished.length} 案</b>，最近的是${nm(unfinished[0].name)}（${done(unfinished[0].completion).text}），最遠的是${nm(unfinished[unfinished.length - 1].name)}（${done(unfinished[unfinished.length - 1].completion).text}）。`,
    '<b>不放售價與實價登錄</b>：這篇只整理公開的建案規格。',
  ],
  faq: [
    {
      q: '鳳鳴重劃區的森聯一共有幾個案子？',
      a: `8 案、共 ${senlianTotal} 戶：森朗、森晴、森朵、森悅、森闊、森藏、森耀、森睦。森鉅承（森鉅建設，森聯機構）不在這 8 案內，它是後來的案子，${by['森鉅承'].households} 戶、${st(by['森鉅承'])}。`,
    },
    {
      q: '京澄為德和京澄為泰是同一個案子嗎？',
      a: '不是。同一個建商在鳳七路、龍三路口有兩塊基地，推出兩個案子：京澄為德先賣，京澄為泰後推。公開資料上兩案規格很接近（兩棟、地上 14 層、各 113 戶），差別在推出時間，要買的話兩案要分開比較。',
    },
    {
      q: '鳳鳴重劃區有哪些建案還沒完工？',
      a: `依公開資料，預計完工日還沒到的有 ${unfinished.length} 案：` + unfinished.map((p) => `${nm(p.name)}（${done(p.completion).text}）`).join('、') + '。',
    },
    {
      q: '表格裡的戶數怎麼算？',
      a: '戶數是住家加店面，有店面的都有標註。樓高是地上層數，多棟樓高不同的取最高的一棟；完工時間目前只到「季」。',
    },
  ],
  sources: `資料來源：PLEX 等公開建案資料（2026 年 9 月）與蔡莎拉手繪的鳳鳴重劃區地圖。戶數含店面，樓高取地上層數最高的一棟，完工時間到季；實際內容以建案公開資訊與買賣契約為準。本文不含售價與實價登錄，資料更新日期 ${todayIso}。`,
  related: ['fengming-zhaiqu-zhide-mai'],
  cta_tool: { label: '開啟鳳鳴重劃區生活地圖', href: 'https://tools.salahome.tw/#fengming-map' },
};

// 簡單的 YAML 輸出：字串一律用 JSON 雙引號寫法（YAML 也接受）
const y = (v) => JSON.stringify(v);
let front = '---\n';
front += `title: ${y(fm.title)}\nseo_title: ${y(fm.seo_title)}\nsubtitle: ${y(fm.subtitle)}\ndescription: ${y(fm.description)}\n`;
front += `region: ${fm.region}\ncategory: ${fm.category}\nauthor: ${fm.author}\ndate: ${fm.date}\nupdated: ${fm.updated}\ntags: ${y(fm.tags)}\n`;
front += 'tldr:\n' + fm.tldr.map((t) => `  - ${y(t)}`).join('\n') + '\n';
front += 'faq:\n' + fm.faq.map((f) => `  - q: ${y(f.q)}\n    a: ${y(f.a)}`).join('\n') + '\n';
front += `sources: ${y(fm.sources)}\nrelated:\n` + fm.related.map((r) => `  - ${r}`).join('\n') + '\n';
front += `cta_tool:\n  label: ${y(fm.cta_tool.label)}\n  href: ${y(fm.cta_tool.href)}\n---\n\n`;

// ---------------- 內文 ----------------
let md = front;

md += `鳳鳴重劃區的建案，看起來名字很多、很雜，但依建商整理之後其實有脈絡。這篇整理了 ${totalCases} 個案子、合計約 ${N(grandTotal)} 戶。

同建商的案子放在一起看，可以並排比較規劃、樓高、推案節奏，也分得清一期、二期、先賣後推；不同案名背後可能是同一個建商，放在一起就不會被案名搞混。

<div class="sala-key">
<div><span>整理的案子</span><b>${totalCases} 案</b><small>約 ${N(grandTotal)} 戶</small></div>
<div><span>最大的一組</span><b>森聯 8 案</b><small>${senlianTotal} 戶</small></div>
<div><span>還沒完工</span><b>${unfinished.length} 案</b><small>預售或興建中</small></div>
</div>

<div class="sala-quote">

同一個建商在同一區的案子放在一起看，才看得出規劃、樓高和推案節奏的差別。

</div>

## 一、怎麼看這份整理

- 戶數是**住家加店面**，有店面的都有標註，例如「60（含 2 戶店面）」。
- 樓高是**地上層數**；一個案子有多棟、樓高不同的，我放最高的。
- 完工時間目前只到「季」；已完工的標「已完工」，預售或興建中的標「預計」。
- 資料整理自 PLEX 等公開建案資料（2026 年 9 月）與我自己手繪的鳳鳴重劃區地圖，實際內容請以建案公開資訊與買賣契約為準。這篇**不放售價和實價登錄**，行情要看再來問我。
- 有些較小、較舊的社區（例如鶯桃小城、金合昌）還在補資料，沒有放進來。

## 二、依建商整理

`;

groups.forEach((g, i) => {
  md += `### ${g.title}\n\n${g.intro}\n\n${table(g.names)}\n\n合計 ${g.names.length} 案、${N(total(g.names))} 戶。\n\n`;
  if (g.after) md += `${g.after}\n\n`;
  if (i === 0) {
    md += `<div class="sala-cta">

**只看森聯 8 案的位置**

打開地圖，一次看到 8 案在哪裡、彼此相隔多遠，也能直接把畫面分享給家人。

<p><a class="sala-btn" href="https://tools.salahome.tw/?show=森聯" target="_blank" rel="noopener">看森聯 8 案的地圖</a></p>

</div>

`;
  }
});

md += `## 三、只有一案的建商

下面這些建商，在這份整理裡各只有一個案子：

| 案名 | 建商 | 戶數 | 地上樓高 | 完工 |
|---|---|---|---|---|
`;
singles.sort((a, b) => (by[b[0]].households || 0) - (by[a[0]].households || 0));
for (const [n, dev] of singles) {
  const p = by[n];
  md += `| ${nm(n)} | ${dev} | ${hh(p)} | ${fl(p)} | ${st(p)} |\n`;
}

md += `
## 四、還沒完工的案子

依公開資料，預計完工日還沒到（預售或興建中）的案子有這些，照完工時間排：

${unfinished.map((p) => `- **${nm(p.name)}**：${st(p)}，${p.households} 戶`).join('\n')}

<blockquote class="sala-says">
<p>建案資料再完整，還是要實際來看。同一個建商的案子，位置、棟距、車位配比、鄰近的公園和學校都不一樣；
你要的是「這一案適不適合你」，不是「這個建商有幾案」。
想直接看某幾案，我可以帶你走一趟，或者先在地圖上把你有興趣的案子圈出來。</p>
</blockquote>

## 五、在地圖上看位置

這些案子的位置、戶數、樓高、完工時間，都放在我做的免費工具**[鳳鳴重劃區生活地圖](https://tools.salahome.tw/#fengming-map)**裡，點一個社區就能看到；
地圖上也有火車站、捷運站、公車、學校、賣場與便利商店，離你想看的案子多遠、走路幾分鐘一次看完。

想只看森聯 8 案的位置，直接開 [tools.salahome.tw/?show=森聯](https://tools.salahome.tw/?show=森聯)。
`;

fs.writeFileSync(OUT, md);
console.log('已輸出', OUT, `（${totalCases} 案、${N(grandTotal)} 戶、${md.length} 字元）`);
