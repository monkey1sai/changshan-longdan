// 把 dist/ 打包成可直接上傳 itch.io 的 HTML5 壓縮檔，並先檢查 itch.io 的限制。
// 限制來源：https://itch.io/docs/creators/html5
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createZip } from './zip.mjs'

const DIST = 'dist'
const OUT_DIR = 'release'
const OUT = `${OUT_DIR}/changshan-longdan-web.zip`
const LIMITS = { files: 1000, fileBytes: 200 * 1024 * 1024, totalBytes: 500 * 1024 * 1024, pathLength: 240 }

function walk(dir, prefix = '') {
  const files = []
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    const rel = prefix === '' ? name : `${prefix}/${name}`
    if (statSync(full).isDirectory()) files.push(...walk(full, rel))
    else files.push(rel)
  }
  return files
}

let files
try {
  files = walk(DIST)
} catch {
  console.error(`找不到 ${DIST}/：請先執行 npm run build`)
  process.exit(1)
}

const errors = []
if (!files.includes('index.html')) errors.push('壓縮檔根目錄必須有 index.html')
if (files.length > LIMITS.files) errors.push(`檔案數 ${files.length} 超過 itch.io 上限 ${LIMITS.files}`)
let total = 0
const entries = files.map((name) => {
  const data = readFileSync(join(DIST, name))
  total += data.length
  if (data.length > LIMITS.fileBytes) errors.push(`${name} 超過單檔上限 200 MB`)
  if (name.length > LIMITS.pathLength) errors.push(`${name} 路徑超過 ${LIMITS.pathLength} 字元`)
  return { name, data }
})
if (total > LIMITS.totalBytes) errors.push('解壓後總大小超過 500 MB')

// itch.io 在子目錄中執行遊戲，以 / 開頭的絕對路徑會載入失敗
if (files.includes('index.html')) {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  const absolute = [...html.matchAll(/\b(?:src|href)="(\/[^"/][^"]*)"/g)].map((m) => m[1])
  if (absolute.length > 0) errors.push(`index.html 含絕對路徑 ${absolute.join('、')}（vite.config.ts 需設定 base: './'）`)
}

if (errors.length > 0) {
  console.error(`無法打包：\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
const zip = createZip(entries)
writeFileSync(OUT, zip)
console.log(`已建立 ${OUT}：${files.length} 個檔案，解壓後 ${(total / 1024).toFixed(0)} KB，壓縮檔 ${(zip.length / 1024).toFixed(0)} KB`)
