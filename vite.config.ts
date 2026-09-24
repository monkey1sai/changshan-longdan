import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // three.js 本身約 700 kB（壓縮前），單一 chunk 超過預設的 500 kB 警告門檻屬正常
    chunkSizeWarningLimit: 1200,
  },
})
