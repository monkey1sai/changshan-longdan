# Jev 實測：2026-09-29

> 本文數據是測試案例分類，並非玩家在當前網頁上的合法動作選擇。請一併閱讀末尾「後續範圍更正」；真人操作與通關流程見 [player-ui-loop.md](player-ui-loop.md)。

狀態：已完成本次 A 的付費路由量測與延伸 holdout。
尚未建立大型模型對照、live Jev → browser 執行迴圈或完整三組端到端比較。
這份報告不能解讀為 token 節省百分比、遊戲效能提升或生產上線核准。

## 授權與方法

使用者於本對話明確授權 Jev AI 使用，不設費用與呼叫次數上限。
沒有修改永久設定、寫入長期記憶、建立排程、commit、push 或部署。
首輪維持原實驗 11 案例 × 三輪，之後新增 18 個未參與首輪的 holdout 案例 × 三輪；
不修改 routing prompt 或 0.9 信心門檻，也未根據 holdout 結果調參。
holdout 在看過 baseline 之後設計，只能作未調參的新措辭檢查，不是外部盲測集。
87 次呼叫來自 29 個不同需求；重複三輪不是 87 個獨立題目。

Authorization Envelope：
- Destination：api.typesafe.ai/v1/systemone。
- Purpose：量測遊戲測試案例的語意分流。
- Allowed：付費推論、既有 Windows User 環境憑證的 process-only 注入、本地報告。
- Data：合成中英需求、精簡合成遊戲狀態、有限候選選項。
- Forbidden：原始碼／截圖／個人資料上傳、金鑰輸出或保存、部署。
- Stop：HTTP/auth/network/model/schema/usage 錯誤；不自動重試。

只有合成資料被傳送。憑證不進 request body、檔案或紀錄。
expected label 留在本地，未放入送給模型的 request。
固定模型 jev-1.13.0；日期當天官方輸入單價每百萬 token USD 0.042，輸出免費。
[官方模型與定價](https://docs.typesafe.ai/models)；
[API usage 定義](https://docs.typesafe.ai/api)。

## VERIFIED：實際結果

| 指標 | Baseline | Holdout |
| --- | --- | --- |
| 不同需求數 | 11 | 18 |
| 呼叫數 | 33 | 54 |
| 原始選項符合 expected | 32/33（96.97%） | 54/54（100%） |
| 加入信心門檻後符合 expected | 31/33（93.94%） | 51/54（94.44%） |
| 接受為自動選案 | 16 | 33 |
| 錯誤自動選案 | 0 | 0 |
| 支援需求被保守轉出 | 2 | 3 |
| 延遲中位數 | 210.17 ms | 206.23 ms |
| 延遲 p95 | 303.73 ms | 345.67 ms |
| input tokens | 21,810 | 35,991 |
| output tokens | 2,356 | 3,882 |
| 依 usage 估算 USD | 0.000916020 | 0.001511622 |

總計 87 次、57,801 input tokens、6,238 output tokens；
估算成本 USD 0.002427642，尚未對供應商帳单做 reconciliation。
49 次被接受的自動選案皆符合標記。54 次可支援的需求中，49 次接受、5 次保守轉出；
另 33 次不支援／歧義需求皆轉出，沒有假裝已完成測試。
這些只是「選到哪個案例」，沒有因此自動授予遊戲 PASS。

延遲從 Node fetch 前開始，到 response.json 解析完結束，包含網路／服務端／解析，
不含 browser、後續案例執行、本地存檔及程序啟動。不可拿來和整段 agent 耗時直接比。

## 保守轉出與原始誤判

- Baseline「檢查普通攻擊第一招及收招」三次都選 attack，
  但兩次 confidence=0.89/0.87，低於 0.9，故轉出；另一次 0.90 接受。
- Baseline 多案例需求「開始後暫停再測攻擊」一輪原始 choice=pause，
  confidence=0.36；門檻成功轉出，沒有錯誤自動執行單一案例。
- Holdout「按出陣後，應該看得到血條與三百名敵軍」三次選 start，
  confidence=0.56/0.52/0.54，皆轉出。
- 沒有降低門檻去消除上述轉出；這會把召回率和誤判風險交換，需更廣的獨立資料才能決定。

## 工程驗證

本次修改 runner 為 --live --suite=baseline|holdout --repeats=N，
budgetUsd=null；批次大小是實驗設計，不是再次要求付費授權。
新增 holdout 與 baseline 不重複、expected 不在 provider state 的測試。
14 個 Vitest 測試檔、102 項測試通過；TypeScript 與 runner 語法通過。
遊戲規則、renderer、input 與 browser runner 沒有修改，因此本次未重跑上一階段
已完成的 Chrome 畫面驗證；歷史結果見 testing-results-2026-09-29.md。
真實 HTTP、模型版本、回應 schema 和 usage 在本次兩批都成功。
auth、timeout 與 HTTP 錯誤分支本次未觸發；不能當作已完成故障注入測試。

## 可追溯證據

- [Baseline 原始報告](../artifacts/jev/2026-09-29T10-45-32.795Z/report.json)
- [Holdout 原始報告](../artifacts/jev/2026-09-29T10-47-41.787Z/report.json)
- [來源 fixtures](../src/testing/routing-fixtures.ts)
- [量測程式](../scripts/jev-benchmark.mjs)
- [重跑與後續比較方法](testing-efficiency.md)

每份原始報告保留來源 SHA-256、base commit、精確 usage、逐筆延遲、
原始 choice、機率分布、門檻後選擇與 expected。
Baseline 是舊批次參數的原始證據，保留其原有 USD 0.10 設定；不事後改寫成無上限。
Holdout 的 report 明確記錄 budgetUsd=null。
artifacts 被 Git 忽略，原始報告保留在本 worktree；分享或遷移時需另行攜帶。

## INFERRED：目前適用方式與界線

這些結果支持把 Jev 當作受限案例分流的候選：本機 API 延遲約 0.2 秒，
本次費用低，信心門檻能避開一個原始的多案例誤選。
還不足以證明真實玩家語句、不同狀態、長序列探索或視覺判斷的可靠性。
固定六案例回歸直接使用 deterministic runner，不必增加 Jev 呼叫；
自然語言有歧義時可補取證據或交大型模型，不能將 escalate 算成已完成。

本次 A 量測完成後停止追加同樣的題目。無待決定事項，沒有背景工作繼續執行。
完整 A/B/C、模型驅動瀏覽器與實際 token 節省比較仍是未完成的後續範圍。
# 後續範圍更正

以下原有六選一及 holdout 結果屬於「測試案例分類」。選項中包含目前畫面無法執行的測試案例，
所以不能當成真人 UI 操作決策的通過證據。使用者提出此邊界後，新增
[真人 UI 迴圈](player-ui-loop.md)，動作只從當下玩家能操作的 UI 建立。

追加的 context ablation（artifacts/jev-context/2026-09-29T11-10-11.685Z/report.json）
同樣是分類實驗：compact / structured_dom / page_text 各 36 答，原始分類皆 36/36；
0.9 門檻後路由分別 33/36、31/36、30/36。108 次共 100,665 input tokens，
7,776 output tokens，估計 USD 0.004227930。這不能推論真人操作成功率，
亦不能證明缺少畫面資訊是或不是 UI 決策失敗的原因。

先前 2026-09-29T11-07-01.000Z 批次於第 67 次呼叫停止（66 答已驗證），
原始無效回覆當時沒有保存，不能確認根因。後續依官方近似機率分布契約修正容差；
診斷重播有效不等於原始失敗已重現。

真正「出陣」操作的獨立實測保存於 artifacts/jev-ui/2026-09-29T11-18-33.186Z/：
同一題重跑 3 次，Jev 均選擇當下可見的出陣按鈕，信心 1；
程式另行驗證 HUD、血條及 300 殘存敵兵。樣本只有 3 次，不能外推一般可靠度。
