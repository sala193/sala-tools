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
