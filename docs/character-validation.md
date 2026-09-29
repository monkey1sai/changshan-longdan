# 趙雲精細角色樣板驗證

日期：2026-09-29。範圍：只替換主角的可視模型，保留戰鬥規則、士兵與場景。

## 資產

- Quaternius Universal Base Characters / Standard / Superhero Male，CC0。
- Blender 4.5.5 LTS 改造與匯出；來源和指令見 `art-source/README.md`。
- 實際 GLB：29,202 三角面、65 根骨骼、4,993,552 bytes，貼圖內嵌。
- 來源 SHA-256 與授權均保留；無需執行期外部下載或 API。

## VERIFIED：確定性檢查

- 原始基線：13 個測試檔、89 項測試通過。
- 新增 GLB 內嵌資產／骨架檢查、遍歷所有招式的蒙皮有限範圍、原槍尖及刀光座標一致性、載入失敗與缺骨回退、跑步／防禦／翻滾／重開局；合計 14 檔、94 項通過。
- `npm run build`：TypeScript 與 Vite 成功。
- `node scripts/package-itch.mjs`：相對路徑、ZIP 檔案數與大小限制通過；只是本地打包，沒有上傳。
- Node 的 GLB 測試只解析實際網格和骨架，不解碼圖片。圖片顯示另由下列瀏覽器觀察支持。

## VERIFIED：網頁 API 操作

使用 `cua_repl` 的網頁 API 操作可見 Codex 內建瀏覽器；沒有用桌面操作完成驗收。

- `http://127.0.0.1:5188/character.html`：精細角色載入，顯示 29,202 三角面；完成原始體素對照、臉部近看、跑步、揮槍、翻滾的按鈕操作及截圖。
- 修正實際觀察到的領口材質鋸齒、圓凸甲片、披風面板裂縫；窄面板的控制項改到底部。
- 網頁工具的滑鼠 click 曾沒有產生頁面狀態變化；已讀取 DOM 確認按鈕及事件存在，再用按鈕鍵盤 Enter 成功切換。這項證據確認鍵盤互動；未把失效的工具 click 當成滑鼠通過。
- 遊戲從「出陣」進入 300 人戰場；`character=ready`、`characterError=null`。
- 網頁按鍵輸入 W、J 後，位置從 `[0,0,42]` 改變，`playerState=attack`、`move=N1`。重開局後仍使用精細角色。
- 遊戲頁的 browser logs 讀取未返回 error/warn。
- 額外來源：Blender 對 CPU 蒙皮後幾何的離線影像，位於忽略的 `artifacts/character/`；不將其混同瀏覽器截圖。

## VERIFIED：短時間幀率觀察

1280×720 的可見遊戲頁，300 名敵兵，`quality=1`。以 requestAnimationFrame 收集 120 幀：p50 ≈ 16.7 ms、p95 ≈ 16.7 ms；遊戲狀態顯示 60 FPS、79 draw calls、451,112 triangles。

這是約兩秒的本機環境觀察，不是新舊同場景效能比較，也不是長時間壓力測試。沒有證據可宣稱效能提升，亦不保證所有裝置或無雙密集特效仍為 60 FPS。

## 限制

- 定位為風格化角色樣板；尚未做服飾史考據、逐指精密抓握、布料碰撞或長時間穿插檢查。
- 未擴充敵兵、高精度場景、水面或後製。
- 未發布到 itch.io；既有線上版本與 release record 不變。
- 本機角色工坊保留新舊對照，方便下一輪造型調整。
