import { defineConfig } from 'vite'

export default defineConfig({
  // 相對路徑：itch.io 等平台會把遊戲放在子目錄或 iframe 裡執行，不能用 / 開頭的絕對路徑
  base: './',
  build: {
    // three.js 本身約 700 kB（壓縮前），單一 chunk 超過預設的 500 kB 警告門檻屬正常
    chunkSizeWarningLimit: 1200,
  },
})
