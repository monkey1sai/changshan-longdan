# 常山龍膽

在瀏覽器裡玩的 PS2 風格一騎當千動作遊戲（musou-like）：趙雲單騎對上三百名魏兵。以 Vite + TypeScript + Three.js 製作；人物、城池與龍全部由程式產生體素模型，音效與配樂全部以 WebAudio 即時合成，沒有任何外部模型、貼圖或音檔。

## 特色

- **連段系統**：一般連擊 N1–N6；打出第 k 下普攻後按蓄力放出 C(k+1)（C1–C6）；空中普攻為跳擊（JA）、空中蓄力為跳躍蓄力（JC）；閃避附無敵時間。
- **打擊感**：命中停頓（hit-stop）、鏡頭震動、色差、放射模糊、受擊白閃、火花與刀光。
- **體素碎片**：士兵被擊破時炸成方塊碎片，受重力彈跳並投射陰影。
- **龍膽亂舞**：青龍繞身盤旋後俯衝撞地；全螢幕金黑雙色調色、電影黑邊與字幕。
- **黃昏城池**：程序天空與雲、飄動的「魏」字軍旗、火盆與燃燒屋頂的 GPU 火焰與濃煙、景深、bloom、ACES 色調映射。
- **三百魏兵同時在場**：分隊列陣、包圍環、攻擊令牌（同時最多 4 人出手）、隊長較耐打且重擊會擊倒。
- **WebAudio 即時合成**：揮擊、命中、碎裂、銅鑼、龍吟、環境音，以及 D 小調五聲音階的戰鼓配樂。
- **動態解析度**：畫面吃力時自動降低渲染倍率。

## 操作

| 操作 | 鍵盤／滑鼠 | 手把 |
| --- | --- | --- |
| 移動 | WASD／方向鍵 | 左搖桿 |
| 普攻 □ | J／滑鼠左鍵 | □／X |
| 蓄力 △ | K／滑鼠右鍵 | △／Y |
| 龍膽 ○（氣滿時） | L | ○／B |
| 跳躍 × | 空白鍵 | ×／A |
| 閃避 | Shift | R1／RB |
| 視角 | Q／E 旋轉、滾輪縮放 | 右搖桿 |
| 暫停 | Esc／P | Start |

## 需求與指令

Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`，瀏覽器需支援 WebGL2。

```sh
npm install        # 安裝相依套件
npm run dev        # 開發伺服器，預設 http://localhost:5173
npm test           # Vitest 單元測試
npm run typecheck  # TypeScript 型別檢查
npm run build      # 型別檢查後建置到 dist/
npm run preview    # 預覽 dist/ 的建置結果
npm run package:itch  # 建置並打包成 itch.io 用的 release/changshan-longdan-web.zip
```

## 上架 itch.io

`npm run package:itch` 會檢查 itch.io 的 HTML5 限制（`index.html` 在根目錄、不含絕對路徑、檔案數與大小上限）後才打包；建置使用相對路徑（`vite.config.ts` 的 `base: './'`），可在子目錄與 iframe 中執行。建置會附上 `THIRD_PARTY_LICENSES.txt`（Three.js 的 MIT 授權全文）。專案頁欄位、中英文說明與上傳步驟見 [docs/itch-page.md](docs/itch-page.md)。

## 結構

| 路徑 | 用途 |
| --- | --- |
| `src/game.ts` | 主迴圈、模式切換（標題／戰鬥／暫停／結果）與各系統的接線 |
| `src/combat/` | 招式表（判定窗、傷害、反應）、連段規則、判定形狀 |
| `src/entities/` | 趙雲狀態機、魏兵 AI 與物理（SoA typed arrays）、場地碰撞 |
| `src/core/` | 數學、輸入（鍵盤／滑鼠／手把）、空間格網、兩節骨骼 IK |
| `src/world/` | 城池配置與幾何、天空、軍旗、火焰、光照、程序貼圖 |
| `src/view/` | 趙雲模型與姿勢、實例化士兵、跟隨鏡頭 |
| `src/fx/` | 體素碎片、火花、塵土、刀光、衝擊波、青龍 |
| `src/render/` | HDR 後製管線（景深、bloom、調色）與材質修補 |
| `src/audio/` | WebAudio 音效與配樂 |
| `src/ui/` | HUD、標題／暫停／結果畫面與樣式 |
| `tests/` | 連段、判定、AI、玩家狀態機、配置等純邏輯的單元測試 |

## 開發用除錯介面

`npm run dev` 時，瀏覽器 console 可使用 `__game`（正式建置不包含）：`state`、`start()`、`fillMusou()`、`heal()`、`setHp(hp)`、`setTimeScale(s)`、`advance(frames, input)`、`damageAll(damage)`。`advance` 以固定 1/60 秒逐幀推進並注入按鍵，分頁不在前景（瀏覽器暫停 `requestAnimationFrame`）時也能驗證。遊戲中按 F3 顯示 FPS、draw call 與解析度倍率。
