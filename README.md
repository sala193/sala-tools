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
