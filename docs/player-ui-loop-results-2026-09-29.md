# 真人 UI 迴圈實測：2026-09-29

## VERIFIED：結果

完成「出陣 → 通關」及「出陣 → 暫停 → 繼續 → 通關」兩個完整情境。
兩次執行的 sourceHashes 完全一致，只更換情境 JSON；兩次 pageErrors 均為空。
執行期間為可見、具焦點 Chrome，使用真實滑鼠鍵盤事件及玩家可見 UI / 小地圖像素。

| 情境 | 操作步數 | 總牆鐘秒數 | Jev 呼叫 | 實際快取操作步 | Input / output tokens | 估計 USD | 結算 |
| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| victory | 59 | 146.618 | 11 | 50 | 7,345 / 700 | 0.000308490 | 300 擊破，A |
| pause-resume-victory | 64 | 161.359 | 11 | 56 | 7,108 / 638 | 0.000298536 | 300 擊破，S |

兩次成功流程合計 123 步、22 次呼叫、106 個實際快取操作步，
14,453 input tokens、1,338 output tokens，估計 USD 0.000607026。
另有 5 個過期判斷被丟棄，包含在模型呼叫與 trace 中，沒有執行。
快取步數不是無快取對照实验的 token 節省百分比。

牆鐘時間包含瀏覽器啟動、觀察、API、操作、截圖及報告等流程，與遊戲顯示的戰鬥時間不同：
第一輪結果頁 2:01、最大連擊 351、受傷 512、A；
第二輪 2:10、最大連擊 256、受傷 356、S。

## 原始證據

- [直接通關 report](../artifacts/player-loop/2026-09-29T11-39-54.369Z/report.json)
- [直接通關 trace](../artifacts/player-loop/2026-09-29T11-39-54.369Z/trace.jsonl)
- [直接通關結算截图](../artifacts/player-loop/2026-09-29T11-39-54.369Z/stage-victory.png)
- [暫停再通關 report](../artifacts/player-loop/2026-09-29T11-42-51.610Z/report.json)
- [暫停再通關 trace](../artifacts/player-loop/2026-09-29T11-42-51.610Z/trace.jsonl)
- [暫停畫面](../artifacts/player-loop/2026-09-29T11-42-51.610Z/stage-pause.png)
- [暫停再通關結算截圖](../artifacts/player-loop/2026-09-29T11-42-51.610Z/stage-victory.png)

artifacts/ 為 ignored 本機證據，未放入 Git。交接到另一台機器時須另行保留或重跑，
不能只依賴本文件連結。來源基準 commit：bb538a892f3aad73bfe581f06bf9a1fdae556980；
實測當時新增測試尚未提交，當時執行的關鍵檔案 SHA-256 在各 report 內。

## 開發中的失敗紀錄

| 批次 UTC | 狀態 | 步數 / Jev 次數 | 觀察與修正 |
| --- | --- | --- | --- |
| 11-30-22.737Z | INCOMPLETE | 7 / 14 | 19 擊破後戰敗；移動方向變動使不相關攻擊也被作廢，並有單次 L 未啟動後長時間空等。修正條件摘要與短連按操作。 |
| 11-33-04.177Z | INCOMPLETE | 21 / 15 | 179 擊破後戰敗；整張像素跨程序傳輸使 3 秒攻擊步實測約 4.4 秒。將同一已測試像素解析放入瀏覽器，避免傳回大量像素。 |
| 11-35-34.375Z | INCOMPLETE | 61 / 10 | 已顯示 300 擊破、殘存 0、完全勝利橫幅，但過場缺少等待動作，Jev 選 no_action。新增短暫等待結算，仍保留原批次未完成狀態。 |

三次失敗加上兩次成功共 61 次 Jev 呼叫、39,765 input tokens、
3,868 output tokens，估計 USD 0.001670130。上述費用只涵蓋 player-loop 五批次，
不含先前分類、context ablation 及獨立出陣測試。
所有批次都有 response usage；價格依本日核對的 input 每百萬 token USD 0.042，
不是供應商帳單。

這些是測試控制器與策略的修正證據；沒有據此修改遊戲產品的戰鬥規則。
耗時變化與血量改善在不同實際遊玩軌跡觀察到，沒有做隔離變因的效能實驗。

## 驗證與限制

- npm test：17 個檔案、122 項測試通過。
- npm run build：TypeScript 與 Vite 建置通過。
- git diff --check：通過。
- 新執行器／轉接器／核心檢查：沒有 __game、setHp、fillMusou、damageAll 或 advance 呼叫。
  這是補充靜態檢查；主要操作證據仍是 trace 與可見瀏覽器截圖。
- 成功案例的全部階段由程式對實際可見結果驗證，Jev 不負責宣告 PASS。
- 只測本機 Chrome、1100 × 900 視窗與這兩個情境；不能外推所有題目、所有裝置或穩定通關率。
- 未做部署、線上站點驗收、手把、音效／主觀手感、全招式或完整碰撞路徑驗證。
- 程式仍有近似辨識：小地圖標記受遮蔽時可能缺失，地圖配色或 UI ID 變更須更新觀察器。
- 信心門檻 0.6 尚未校準；低信心、無合法選項、失焦、戰敗、無進展與執行上限均會停止。

重跑及新增題目的方式見 [使用說明](player-ui-loop.md)。
交付使用獨立分支 codex/player-visible-test-loop；原工作目錄的 main 尚未合入，
亦未部署。上列瀏覽器量測仍對應 2026-09-29 的原始報告與來源雜湊。

## 2026-09-30 提交前驗證

於交付工作樹重新執行 npm test（17 個檔案、122 項測試）及 npm run build，
兩者通過。npm run test:jev:dry 完成離線 fixture 準備，modelCalls=0；
這項乾跑不提供模型正確率證據。本次整理提交沒有重跑付費 API 或真人瀏覽器通關，
瀏覽器證據沿用上列兩個已完成情境。
