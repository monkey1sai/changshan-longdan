# Game

用 Vite + TypeScript + Canvas 2D 建立的網頁遊戲骨架，沒有使用遊戲引擎。目前的內容是一個可以用方向鍵或 WASD 移動的方塊，用來確認遊戲迴圈、輸入與繪製都能正常運作。

## 需求

- Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`（與 `package.json` 的 `engines` 相同）
- npm

## 指令

```sh
npm install        # 安裝相依套件
npm run dev        # 開發伺服器，預設 http://localhost:5173
npm test           # Vitest 單元測試
npm run typecheck  # TypeScript 型別檢查
npm run build      # 型別檢查後建置到 dist/
npm run preview    # 預覽 dist/ 的建置結果
```

## 結構

| 路徑 | 用途 |
| --- | --- |
| `index.html` | 頁面與 `<canvas id="game">` |
| `src/main.ts` | 進入點：取得 canvas、啟動遊戲迴圈 |
| `src/game.ts` | 遊戲狀態與 `update()`，不碰 DOM 的純函式 |
| `src/input.ts` | 鍵盤輸入 |
| `src/render.ts` | Canvas 2D 繪製 |
| `tests/` | Vitest 測試 |

遊戲規則寫在 `game.ts` 這類純函式裡，`npm test` 就能直接驗證；`main.ts`、`input.ts`、`render.ts` 只負責和瀏覽器接線。
