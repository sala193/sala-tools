# 蔡莎拉的工具箱（tools.salahome.tw）

買房、賣房前的免費試算工具，獨立於官網 salahome.tw，掛在子網域 `tools.salahome.tw`。

- 框架：Astro（靜態輸出），部署在 Vercel
- 樣式：`src/styles/global.css`（品牌 token）＋ `src/styles/calc.css`（計算機共用）
- 頁面：`src/pages/`（工具首頁、購屋能力、房貸月付金、房地合一稅）

## 本機開發

```
npm install
npm run dev
```

## 新增一個工具

1. 在 `src/pages/` 新增頁面（可參考 `loan.astro`），引入 `calc.css`
2. 在 `src/pages/index.astro` 的 `groups` 加一筆（同時會進到 ItemList 結構化資料）
3. 在 `src/components/Header.astro`、`Footer.astro` 加連結

## 注意

`@astrojs/sitemap` 固定在 3.2.1：更新版本是給 Astro 5 用的，跟目前的 Astro 4 不相容。

## 鳳鳴重劃區生活地圖（/map）

- 頁面：`src/pages/map.astro`，樣式 `src/styles/map.css`，地圖套件 Leaflet（npm 安裝，固定 1.9.4）
- 資料：`src/data/poi-fengming.json`，由 `scripts/fetch-poi.mjs` 產生（不用登入、不需 API 金鑰）
  - 車站、公車站、交流道、學校、幼兒園：OpenStreetMap（Overpass API，ODbL，頁面已標示來源）
  - 微笑單車（YouBike 2.0）：YouBike 官方公開站點資料
  - 底圖：內政部國土測繪中心（電子地圖、空拍影像）與 OpenStreetMap
- 更新資料：`node scripts/fetch-poi.mjs`，再重新部署。資料日期會顯示在頁面上
- 新增類別（醫院、超市、公園…）：
  1. `fetch-poi.mjs` 的 `QUERY` 加 Overpass 條件，並新增對應的整理函式
  2. `map.astro` 的 `CATS`、`ORDER` 與 `map.css` 的 `.poi-類別` 顏色各加一筆
- 換一個地區做同款地圖：改 `fetch-poi.mjs` 的 `CENTER` 即可

### 社區位置

- 來源：OpenStreetMap 上有名稱的住宅用地與住宅建築（同名合併成一點），施工中的住宅用地標為「新建案」
- 只收錄地圖社群已標註的，可能漏標；漏掉的社區可以到 openstreetmap.org 補標，下次更新資料就會出現
- 官網有寫過開箱文的社區，在 `src/data/community-links.json` 加一行「OSM 上的名稱 → 官網網址」，彈出視窗就會出現連結

### 社區戶數與補充社區（手繪地圖資料）

- 檔案：`src/data/community-info.json`（可直接手動修改）
  - `matched`：OSM 已有的社區，補上戶數（`osm` 是 OSM 上的名稱，`name` 可選，用來改顯示名稱）
  - `added`：OSM 沒有的社區，用手繪圖位置新增（`px` 是手繪圖上的像素位置，`lat`/`lng` 是換算後的座標，誤差約 10～30 公尺；`note` 是待確認事項，不會顯示在網頁上）
- 修改後執行 `node scripts/fetch-poi.mjs` 重新產生資料，再重新部署
- 座標換算：以手繪圖上 29 個同時存在於 OSM 的社區當控制點做仿射對位（平均誤差約 11 公尺、最大 26 公尺）

### 土地使用與社區基地外框（fengming-zones.json）

- 來源：蔡莎拉手繪的鳳鳴重劃區地圖（底圖為國土測繪地籍圖，色塊是社區基地與各種用地）
- 產生：`node scripts/extract-zones.mjs <手繪地圖圖檔> [--qa 疊圖.png]`
  - 依色塊填色抽出外框，簡化成多邊形，再用「圖上與 OSM 都有」的社區當控制點對位成經緯度（目前平均誤差約 9 公尺、最大約 21 公尺）
  - `--qa` 會輸出把外框疊回原圖的檢查圖，改設定後務必看一次
  - 圖檔本身不放進專案，只保留轉出的多邊形（`src/data/fengming-zones.json`）
- 只有「單一填色」的基地能可靠抽出；圖上是建築照片或圖示的（森聯之王系列、微笑海悅2、青松翫…）不畫外框，只保留點位（腳本裡的 `NO_PARCEL`）
- 相鄰同色被抓成一塊的，沿交界線切開（`SPLITS`）；新增用地或社區，改腳本最上面的 `ZONES`、`COMMUNITIES`
- 面積是依圖面比例概算，網頁上標「約」
- 腳本也會把「手繪圖新增」社區的座標，改用基地外框中心回寫到 `community-info.json`（像素位置 `px` 是依據，改座標請改 `px`）

### 社區詳細資料（完工日期、樓高…）

- 檔案：`src/data/community-details.json`，以「地圖上顯示的社區名稱」當 key，欄位都可省略：
  `completion`（完工日期，西元 `2025-12-30`，只知道年月寫 `2025-12`，只知道年寫 `2025`；網頁自動轉民國年，日期還沒到會顯示「預計完工」）、
  `floorsUp`／`floorsDown`（地上、地下層數）、`baseAreaPing`（基地坪數）、`publicRatio`（公設比）、`parking`（車位數）
- 目前地圖顯示：完工日期、樓高；基地坪數、公設比、車位數先存著，要顯示時在 `map.astro` 的彈窗加一行即可
- 修改後執行 `node scripts/fetch-poi.mjs` 再重新部署；名稱對不上時腳本會提示

### 建商群組按鈕（例如「森聯 8 案」）

- 在 `src/data/community-details.json` 幫社區加 `"developer": "森聯"`，同一個建商有 2 個以上社區，地圖就會自動出現「🏢 建商 N 案」按鈕
- 按下按鈕：只顯示該建商的社區，圖釘旁直接標名稱與戶數，縮放到剛好看到全部，清單顯示合計戶數；再按一次或按「看全部」還原
- 分享連結：網址加 `?show=建商名`（例如 `https://tools.salahome.tw/map?show=森聯`），客戶打開就是只看這幾案；畫面上的「複製分享連結」按鈕可直接複製
- 社區顯示名稱在 `community-info.json`（`matched[].name`，OSM 原名會保留在 `osmName`）；官網連結在 `community-links.json`，key 用顯示名稱

### 社區平面圖

- 圖檔放 `public/images/plans/`，在 `community-details.json` 的社區加 `"plan": "/images/plans/檔名.jpg"`，地圖彈窗就會出現「🖼️ 看社區平面圖」，點開是可放大、可另開新分頁的大圖
- 圖片建議寬度 2000px 以上（放大 2 倍時才不會糊）、單檔 500KB 內
- 也可以同時在 `community-links.json` 設官網社區開箱文章連結，彈窗會多一行「看蔡莎拉的社區開箱 →」，兩種並存

### 讓客戶記得蔡莎拉（品牌露出）

- **分享連結預覽圖**：`public/images/og/map.jpg`（地圖頁）、`default.jpg`（其他頁），LINE、Facebook 貼連結時顯示。要改文字或換照片：修改 `scripts/make-og.mjs` 後執行 `node scripts/make-og.mjs`（需要 Windows 內建的微軟正黑體）
- **頁面標題**：一律「蔡莎拉｜頁面名稱」，名字放最前面
- **固定聯絡按鈕**：`BaseLayout.astro` 裡的 `float-contact`，所有頁面右下角都有 LINE，手機版多一顆電話
- **「我想了解這案」**：社區彈窗的按鈕，用 LINE 官方帳號預填訊息（`https://line.me/R/oaMessage/@saLa193/?訊息`），客戶按下去只要送出，蔡莎拉就知道他對哪一案有興趣
- **客戶畫面署名**：「只看某建商」的畫面會顯示「由蔡莎拉整理・電話」與 LINE 按鈕

### 電腦版的「我想了解這案」（LINE 視窗）

- LINE 預填訊息連結（`https://line.me/R/oaMessage/@saLa193/?訊息`）只有**手機的 LINE App** 開得了，電腦瀏覽器會被轉到 LINE 首頁
- 所以電腦上點這類連結時，`BaseLayout.astro` 會攔截並跳出視窗：QR Code（手機掃描加好友）＋可複製的那句話＋加好友頁面連結；手機維持直接開 LINE
- QR Code：`public/images/line-qr.svg`，由 `node scripts/make-qr.mjs` 產生（內容是 `https://line.me/ti/p/@saLa193`）；要換 LINE 帳號時改這支腳本重跑
- 只攔截 `/R/oaMessage/` 這種連結；一般的加好友連結（`line.me/ti/p/...`）不受影響
