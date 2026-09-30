# 遊玩迴圈 P2 修復與驗證：2026-09-30

## 變更與原因

修復兩個會影響可重用驗證流程的執行器缺陷：

- 完成階段先於期限檢查，導致最後一個動作逾時仍可 PASS。現在每輪在接受完成條件前
  檢查期限，API 與觀察後在輸入前重查，最後階段截圖後也須仍在期限內。
- 勝利／敗北畫面一律中止，導致配置的再戰階段無法執行。現在只有階段明確允許
  click_retry 且觀察到該可用按鈕時才繼續；再戰成功後重設方向校準、擊破進度
  與無進展計時。非預期結算仍停止，不能用自動重開掩蓋失敗。

沒有修改遊戲規則、正式入口、API 契約、套件依賴、環境變數名稱、部署或排程。

## VERIFIED：離線回歸

tests/player-runner.test.mjs 透過隔離 Node 程序與 VM 執行實際 CLI runner 原始碼，
僅模擬 UI、供應商、檔案寫入與時鐘；不是複製 runner 控制流程來測自己的副本。
金鑰為測試哨兵，不讀實際憑證，不開瀏覽器或呼叫 API。

新增 10 項測試，原 runner 有 6 項失敗、4 項通過；修復後 10 項全部通過，涵蓋：

- 1,000 ms 期限下，3,100 ms 才完成目標必須 INCOMPLETE；剛好到期限也不通過。
- 模型等待耗盡期限後不能再輸入；已收到的 usage 仍記錄。
- 最後階段截圖跨越期限，不能宣告整個情境 PASS。
- 在期限內使用最後允許的一步完成目標仍可通過。
- 通關後明確再戰、重設校準，第二局持續擊破超過 90 秒仍能正常完成。
- 未明確允許再戰、按鈕不在可見控制項中或非預期戰敗，仍停止。
- 明確配置的敗北後再戰可執行。

完整 npm test：18 個測試檔、132 項通過。
npm run build：TypeScript 與 Vite 通過。
三個新增／修改的 mjs 執行與測試檔 node --check 通過。
git diff --check 通過。

## VERIFIED：可見 Chrome 真人操作

以 tests/scenarios/victory-retry-victory.json 執行同一個修復後 runner：

| 階段 | 累計步數 | 玩家可見結果 |
| --- | ---: | --- |
| start | 1 | 出陣，擊破 0，敵兵 300 |
| first-victory | 58 | 完全勝利，300 擊破，S |
| retry | 59 | 點擊可見再戰，回到戰鬥，擊破 0，敵兵 300 |
| second-victory | 121 | 再次完全勝利，300 擊破，S |

總牆鐘 307.489 秒，18 次 Jev 呼叫，105 個實際快取操作步，
2 個過期決策被丟棄。12,026 input tokens、1,134 output tokens，
estimatedCostUsd=0.000505092、costComplete=true。
估算依當日核對的 [官方模型價格](https://docs.typesafe.ai/models)
每百萬 input token USD 0.042、output 免費；不是供應商帳單。

第一局結果：戰鬥時間 2:03、最大連擊 254、受傷 390、S。
第二局結果：戰鬥時間 2:07、最大連擊 208、受傷 130、S。
pageErrors 為空；Chrome 顯示既有 WebGL shader 精度 warning X4122，
沒有將 warning 隱藏或當作效能改善證據。

第 59 步 trace 的操作為 click_retry，操作前可見控制項包含「再戰」；
操作後 mode=playing、ko=0、remaining=300，navigation 的 forward/right
重設為 null、blocked=0。之後以實際移動重新校準。
全程只用真實滑鼠鍵盤、可見 DOM 與小地圖已畫出的像素。

## 原始證據與限制

- [report.json](../artifacts/player-loop/2026-09-30T03-55-56.897Z/report.json)
- [trace.jsonl](../artifacts/player-loop/2026-09-30T03-55-56.897Z/trace.jsonl)
- [第一局結算](../artifacts/player-loop/2026-09-30T03-55-56.897Z/stage-first-victory.png)
- [再戰後的新一局](../artifacts/player-loop/2026-09-30T03-55-56.897Z/stage-retry.png)
- [第二局結算](../artifacts/player-loop/2026-09-30T03-55-56.897Z/stage-second-victory.png)

artifacts 為 ignored 本機證據，不隨 Git push 上傳；交接須另行保留或重跑。
實測使用 parent commit ecc40b296322b68ca5f5c0d8fe6ecbedc351c86a 上的修復後工作樹；
報告的七個關鍵來源 SHA-256 與情境 SHA-256 均已核對，符合本次交付檔案。

期限邊界與敗北後再戰以離線回歸驗證；這次可見 Chrome 實測驗證勝利後再戰及
兩次完整通關，沒有執行真實 HTTP 故障注入或實際戰敗流程。
只是一個本機 Chrome、1100 × 900 情境樣本，不代表一般穩定通關率、主觀手感、
所有裝置或線上部署驗收。沒有部署、合併或排程；runner 已關閉自己建立的
Chrome 與 Vite。
