# 蔡莎拉的工具箱（tools.salahome.tw）

買房、賣房前的免費工具，**整個網站只有一頁**：首頁是一張一張的工具卡片（沒有選單、沒有目錄），點一張卡片，工具會在同一頁內滑出來，網址變成 `/#工具代號`（可分享，上一頁／Esc／「← 所有工具」返回），獨立於官網 salahome.tw，掛在子網域 `tools.salahome.tw`。外觀刻意和官網不同：冷色調藍色系、全黑體、圓角卡片、LINE 綠按鈕。

- 框架：Astro（靜態輸出），部署在 Vercel
- 樣式：`src/styles/global.css`（品牌 token）＋ `src/styles/calc.css`（計算機共用）
- 頁面：`src/pages/index.astro` 是唯一的頁面：上方一段簡介、中間是工具卡片、下方聯絡區；每個工具是 `src/components/tools/` 裡的一個元件，放在「滑出頁」（`.sheet`）裡，平常看不見
- 地圖比較重，第一次點開「地圖」卡片才會初始化（`MapTool.astro` 監聽 `tool-open` 事件）；網址直接帶 `/#fengming-map` 也會正確開啟
- 舊網址 `/map`、`/afford`、`/loan`、`/unit-price`、`/capgain` 是轉址頁（`src/layouts/Redirect.astro`），會跳到首頁對應的位置並保留 `?show=森聯` 這類參數；不放進 sitemap
- 外觀：`src/styles/global.css` 最上面的色彩 token（`--gold` 實際是亮藍、`--ink` 深海軍藍）＋ `src/styles/onepage.css`（頂端、頂部大標、區塊、結尾、頁尾）
- 頁尾保留兩家店的經紀業資訊（廣告合規），不要拿掉

## 本機開發

```
npm install
npm run dev
```

## 新增一個工具

工具會一直增加，新增只要兩步：

1. 在 `src/components/tools/` 新增元件（可參考 `UnitPriceTool.astro`）：最外層 `<section class="tool" id="工具代號">`，所有 `id` 加自己的前綴（例如 `ln-`），script 用 `(() => { ... })()` 包起來，radio 用 `form.querySelector` 只在自己的表單裡找，避免和其他工具互相干擾
2. 在 `src/pages/index.astro` 上方的 `tools` 陣列加一筆：`id`（同上）、`icon`（emoji）、`name`、`desc`（一句話，用「使用者的處境」寫）、`tag`（卡片右上角小標籤）、`Component`。卡片、滑出頁、網址 `#id`、給搜尋引擎的結構化資料都會自動產生

不要加選單或目錄連結（這個網站刻意沒有）；卡片順序就是 `tools` 陣列的順序。

## 注意

`@astrojs/sitemap` 固定在 3.2.1：更新版本是給 Astro 5 用的，跟目前的 Astro 4 不相容。

## 房貸與購屋能力試算（/#loan）

- 一張卡片、一個計算機、三個分頁，由 `MortgageTool.astro` 組合（分頁切換、按鈕帶值）：**月付金試算**（`LoanPanel.astro`：貸款金額 → 月付）、**月付反推房價**（`ReversePanel.astro`：每月願意繳多少＋自備 2/3/4 成 → 可買多少錢，房價＝月付換算的貸款 ÷ 貸款成數，並列出稅費雜支 3～5% 與各成數對照）、**購屋能力**（`AffordPanel.astro`：月收入＋自備款 → 買得起多少）
- **刻意不顯示「總利息」「總還款金額」「利息佔貸款金額」**：客戶看到那幾個數字會被嚇到、不想買房。以後不要加回來；月付金、寬限期結束後月付會跳多少（這是要提醒的風險）則保留
- 購屋能力算出結果後，有「用這個貸款金額，算每月月付金 →」按鈕，會把可貸金額、利率、年限帶到月付金分頁
- 網址 `/#afford`（舊網址 `/afford`）開在「購屋能力」分頁、`/#reverse` 開在「月付反推房價」分頁（首頁 `index.astro` 的 `ALIAS`）

## 房貸試算頁的「最新房貸利率新聞」連結（/loan）

- 三個分頁（月付金試算、月付反推房價、購屋能力）只要有「貸款利率」欄，欄位下面都會出現「現在的房貸利率行情」（元件 `src/components/tools/RateHint.astro`）：官方統計五大銀行平均、公股、民營、新青安 3.0 的利率，加上完整整理的新聞連結。點行情裡的利率（有外框的那幾個）會直接填進利率欄並重算；新青安前 3 年優惠利率不適合當單一利率，只顯示文字
- 資料：`src/data/rate-news.json`：`month`、`title`、`url`、`source`、`published`、`checkedAt`，以及 `rates`（四筆：`label`、`text` 顯示文字、`fill` 點了填進利率欄的數字或 `null`、`note` 一句說明）
- 每月 1 日更新（排程任務 `update-rate-news`，蔡莎拉的電腦開著 Claude 桌面版才會跑；沒開會在下次開啟時補跑）。也可以手動照下面做：
  1. 搜尋最新一期的房貸利率整理文章：優先 Yahoo 股市「○年○月房貸利率總整理」（賣厝阿明專欄），找不到再用同性質的財經媒體文章。要是**當月**或**上個月**的
  2. 打開連結確認能讀、確認標題與發布日期；不要用付費牆、要登入或內容農場的頁面
  3. 改 `rate-news.json`：`month`、`title`（照原標題）、`url`、`source`、`published`，`checkedAt` 填當天；`rates` 的數字**照文章寫**，不要自己推算
  4. `npm run build` → 提交、推到 `main` → `npx vercel deploy --yes`（預覽版），最後請蔡莎拉到 Vercel 按 Promote to Production 才會上線
  5. 找不到比現在更新的文章就不要改，只回報「這個月沒有新的」
- 只放連結、標題與利率數字，不轉載內文

## 房屋單價計算機（/unit-price）

- 頁面：`src/components/tools/UnitPriceTool.astro`，純前端計算，不留資料
- 兩種算法：**總價 → 單價**、**單價 → 總價**；面積一律用「坪」
- 輸入：總價（或單價）、車位價格、權狀總面積、其中車位面積；選填主建物、附屬建物面積
- 輸出：扣車位的每坪單價（實價登錄常用口徑）、含車位單價（總價 ÷ 權狀）、室內單價（主建物＋附屬）、主建物單價、車位每坪、公設比（不含車位），並附「單價每差 1 萬，總價差多少」的談價參考
- 公設比＝（權狀 − 車位 − 主建物 − 附屬）÷（權狀 − 車位）；各建案、地政的口徑可能略有不同，頁面已註明

## 鳳鳴重劃區生活地圖（/map）

- 頁面：`src/components/tools/MapTool.astro`，樣式 `src/styles/map.css`，地圖套件 Leaflet（npm 安裝，固定 1.9.4）
- 資料：`src/data/poi-fengming.json`，由 `scripts/fetch-poi.mjs` 產生（不用登入、不需 API 金鑰）
  - 車站、公車站、交流道、學校、幼兒園：OpenStreetMap（Overpass API，ODbL，頁面已標示來源）
  - 微笑單車（YouBike 2.0）：YouBike 官方公開站點資料
  - 底圖：內政部國土測繪中心（電子地圖、空拍影像）與 OpenStreetMap
- 更新資料：`node scripts/fetch-poi.mjs`，再重新部署。資料日期會顯示在頁面上
- 新增類別（醫院、超市、公園…）：
  1. `fetch-poi.mjs` 的 `QUERY` 加 Overpass 條件，並新增對應的整理函式
  2. `MapTool.astro` 的 `CATS`、`ORDER` 與 `map.css` 的 `.poi-類別` 顏色各加一筆
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
  `completion`（完工日期，西元 `2025-12-30`，只知道年月寫 `2025-12`，只知道年寫 `2025`，只知道季度寫 `2027-Q2`；網頁自動轉民國年，日期還沒到會顯示「預計完工」）、
  `floorsUp`／`floorsDown`（地上、地下層數）、`baseAreaPing`（基地坪數）、`publicRatio`（公設比）、`parking`（車位數）
- 彈窗顯示：戶數、棟數、建商、完工日期、樓高、基地坪數・公設比・車位數、地址
- 2026-09 用 PLEX（plex.com.tw）的公開建案資料補齊 1 公里內大部分社區的建商、完工季度（`2027-Q2` 格式）、樓高、棟數、基地坪數、公設比、車位數、門牌；只補「還沒有」的欄位，不覆蓋手動填的。森聯系列的 `developer` 維持「森聯」（群組按鈕要靠它）
- 戶數以蔡莎拉手繪圖為準；和 PLEX 的「住家＋店面」相符的，加註「含 N 戶店面」；不符的（新潤幸福莊園、丞石菁英薈、青松翫、鳳鳴尊邸）沒改，待確認
- PLEX 查不到、還沒補的：國際新城、冠奕深耕11、馥春居、合康建設（135 戶）、鶯桃小城、山水綠庭 1／2、梧桐莊園、金合昌、鳳鳴園、鳳鳴首席芳鄰，以及 1 公里以外的社區
- 修改後執行 `node scripts/fetch-poi.mjs` 再重新部署；名稱對不上時腳本會提示

### 建商群組按鈕（例如「森聯 8 案」）

- 在 `src/data/community-details.json` 幫社區加 `"developer": "森聯"`，同一個建商有 2 個以上社區，**而且名字在 `MapTool.astro` 的 `FEATURED_DEVELOPERS` 清單裡**，地圖才會出現「🏢 建商 N 案」按鈕。目前只有「森聯」；其他建商資料齊了也不放按鈕（太亂、對客戶沒有強調意義），要加就把建商名加進那個清單
- 網址 `?show=建商名` 對所有建商都能用，只是沒有按鈕
- 按下按鈕：只顯示該建商的社區，圖釘旁直接標名稱與戶數，縮放到剛好看到全部，清單顯示合計戶數；再按一次或按「看全部」還原
- 分享連結：網址加 `?show=建商名`（例如 `https://tools.salahome.tw/?show=森聯`），客戶打開就是只看這幾案；畫面上的「複製分享連結」按鈕可直接複製
- 社區顯示名稱在 `community-info.json`（`matched[].name`，OSM 原名會保留在 `osmName`）；官網連結在 `community-links.json`，key 用顯示名稱

### 社區平面圖

- 圖檔放 `public/images/plans/`，在 `community-details.json` 的社區加 `"plan": "/images/plans/檔名.jpg"`，地圖彈窗就會出現「🖼️ 看社區平面圖」，點開是可放大、可另開新分頁的大圖
- 圖片建議寬度 2000px 以上（放大 2 倍時才不會糊）、單檔 500KB 內
- 也可以同時在 `community-links.json` 設官網社區開箱文章連結，彈窗會多一行「看蔡莎拉的社區開箱 →」，兩種並存

### 讓客戶記得蔡莎拉（品牌露出）

- **分享連結預覽圖**：`public/images/og/default.jpg`（整個網站只有一頁，就這一張；藍色漸層、LINE 綠按鈕，和官網的金色風格不同），LINE、Facebook 貼連結時顯示。要改文字或換照片：修改 `scripts/make-og.mjs` 後執行 `node scripts/make-og.mjs`（需要 Windows 內建的微軟正黑體）
- **頁面標題**：「蔡莎拉的工具箱｜鳳鳴買房賣房免費工具」，名字放最前面
- **固定聯絡按鈕**：`BaseLayout.astro` 裡的 `float-contact`，所有頁面右下角都有 LINE，手機版多一顆電話
- **「我想了解這案」**：社區彈窗的按鈕，用 LINE 官方帳號預填訊息（`https://line.me/R/oaMessage/@saLa193/?訊息`），客戶按下去只要送出，蔡莎拉就知道他對哪一案有興趣
- **客戶畫面署名**：「只看某建商」的畫面會顯示「由蔡莎拉整理・電話」與 LINE 按鈕

### 電腦版的「我想了解這案」（LINE 視窗）

- LINE 預填訊息連結（`https://line.me/R/oaMessage/@saLa193/?訊息`）只有**手機的 LINE App** 開得了，電腦瀏覽器會被轉到 LINE 首頁
- 所以電腦上點這類連結時，`BaseLayout.astro` 會攔截並跳出視窗：QR Code（手機掃描加好友）＋可複製的那句話＋加好友頁面連結；手機維持直接開 LINE
- QR Code：`public/images/line-qr.svg`，由 `node scripts/make-qr.mjs` 產生（內容是 `https://line.me/ti/p/@saLa193`）；要換 LINE 帳號時改這支腳本重跑
- 只攔截 `/R/oaMessage/` 這種連結；一般的加好友連結（`line.me/ti/p/...`）不受影響

### 地圖版面（放大、清單收合、全螢幕）

- 地圖占滿寬度，高度為「視窗高度 − 110px」（最小 520px），往下捲一下整個畫面就是地圖；版面樣式在 `map.css` 的 `.map-canvas`
- 清單預設收起：地圖左上角的「📋 清單」開關，電腦是從右邊蓋上來的面板，手機是從下方蓋上來（點項目會自動收起）
- 「⛶ 全螢幕」：地圖鋪滿整個畫面，按 Esc 或「✕ 離開全螢幕」回來；固定的 LINE 按鈕在全螢幕時仍在最上層
- 一頁式後，地圖在頁面中間：滾輪與手機單指拖曳預設不吃掉頁面捲動，要「點一下地圖」才啟用（地圖上有提示，點到地圖外面就還給頁面）；全螢幕時直接啟用

### 基準點（紅星）的操作

- 平常點地圖**不會**移動紅星（避免客戶點空白處誤觸）
- 換基準點的方式：拖曳紅星；或按「🎯 點地圖選基準點」再點一次地圖（選完自動關閉、游標變十字）；或「📍 用我的位置」；「回到鳳鳴站」還原

### 商店（賣場、餐飲、便利商店）

- 資料：`src/data/hand-shops.json`。每家有 `sub`（賣場／餐飲／便利商店）、`status`（**營業中**或**預定地**）、`source`、可選的 `addr`、`note`
- 兩種來源：
  - `source: "手繪"`：只有還沒營業、Google 地圖上找不到的預定地（全聯、寶雅）。依手繪地圖，有 `px`（手繪圖上的像素位置，是依據），`lat`／`lng` 由 `node scripts/extract-zones.mjs <手繪圖>` 依 `px` 換算後回寫，彈窗寫「位置由蔡莎拉製作，為概略位置」
  - `source: "Google 地圖"`：已營業的店，店名、地址、座標都是在 Google 地圖上查到的（2026-09），沒有 `px`，不會被換算覆蓋，彈窗寫「店名與位置依 Google 地圖」
- 改完執行 `node scripts/fetch-poi.mjs` 產生地圖資料
- 預定地（還沒營業）的圖釘是灰色虛線框，彈窗寫「預定地・尚未營業」；店開了就把 `status` 改成「營業中」，並改成 Google 地圖上的店名與座標（刪掉 `px`、`source` 改「Google 地圖」）
- 查 Google 地圖座標的方法：在 Google 地圖搜尋清單裡，每家店連結網址的 `!3d緯度!4d經度` 就是座標
- **商店 logo**：圖釘用品牌 logo（`hand-shops.json` 每家的 `logo` ＝ `public/images/logos/` 下的檔名，160px 內的 PNG）；預定地的 logo 自動變灰、外框虛線。logo 只用來辨識店家位置，商標屬各品牌所有。來源：
  - 官網：萊爾富（hilife.com.tw，取愛心圖案）、全聯（pxmart.com.tw，取標誌）、思夢樂（shimamura.com.tw）、錢都（chientu.com.tw）、星巴克（starbucks.com.tw 分享圖，裁成圓形）、全家（Wikimedia Commons，取綠藍條紋）
  - Wikimedia Commons：7-ELEVEN、OK超商、麥當勞、寶雅（POYA，橫式改上下疊）
  - 大埔鐵板燒沒有官網，從蔡莎拉的街景照裁下招牌
- **現場照片**：商店加 `photo`（`public/images/shops/` 下的檔名，jpg）與 `photoNote`，彈窗會顯示照片、點照片可放大，圖釘右下角有 📷 角標。目前 星巴克／大埔／錢都／京懋接待會館共用一張蔡莎拉 2026-09 在鶯歌路拍的街景（1600px、約 200KB）；要換照片就換檔案，或再放一張並改檔名
- 建案的接待會館用 `sub: "接待會館"`、`status` 留空，放在同一個檔案（例：京懋明日和，接待會館在鶯歌路，建案基地在鳳七路口，兩處分開標）
- `node scripts/fetch-poi.mjs` 若發現任何一類資料比上次少 15% 以上（備援伺服器偶爾回傳不完整），會拒絕寫檔；確定要以新資料為準才加 `--force`
- 目前不含鶯桃路南段（長虹門市、鶯歌鶯桃麥當勞等，已在重劃區南邊）、85度C、屈臣氏、超市（自由聯盟、美廉社）
