import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tools.salahome.tw',
  // 只有首頁放進 sitemap（舊網址是轉址頁）
  integrations: [sitemap({ filter: (page) => new URL(page).pathname === '/' })],
});
