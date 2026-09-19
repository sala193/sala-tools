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
