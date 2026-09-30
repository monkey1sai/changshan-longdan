# 2026-09-29 本地遊戲測試紀錄

狀態：本地工具與瀏覽器驗證已完成；Jev 付費量測及完整三組比較尚未執行。
此行為第一階段歷史狀態。後續使用者已授權 Jev 不設費用上限，
並完成 87 次付費呼叫，見 [Jev 實測紀錄](jev-results-2026-09-29.md)；
完整三組比較仍尚未執行，下方第一階段數字保留原樣。
來源 base commit：bb538a892f3aad73bfe581f06bf9a1fdae556980。
本次新增檔案尚未提交，完整 runner 與遊戲关键來源 SHA-256 見下列報告。

## VERIFIED

- 修改前：13 個測試檔、89 項 Vitest 通過，TypeScript 通過。
- 修改後：14 個測試檔、101 項 Vitest 通過。
- npm run build 通過（含 TypeScript）；git diff --check 通過。
- Chrome 153.0.8010.54，可見、獨立 profile，viewport 1100×720。
- 六項 hook 案例 × 三輪皆 PASS；每輪 41 斷言，共 123 個斷言通過。
- 六項實際輸入流程皆 PASS：開始、暫停/繼續、j 攻擊、f 守勢、l 無雙、敗北/再戰。
- 最終 runner 範圍耗時 18,258.7328 ms，包含 Vite/Chrome 啟動後的測試與截圖、
  三輪 hooks 及一輪 input，不含後續關閉清理；不是模型對比的端到端基準。
- 標題場景完整 state JSON 320 bytes，compact 152 bytes，減少 52.5%。
  頁面文字另為 948 bytes；三者資訊不同，不能拿大小差異證明視覺等效或 token 節省率。
- 可見 rAF 取樣 119 個幀間隔，中位數 16.7 ms、p95 16.8 ms，quality=1。
  是重新開始後的單次場景取樣，不是壓力測試、效能提升或主觀手感判定。
- pageerror 與 console error 均為 0。shader 精度 warning X4122 有記錄。
- 離線 Jev fixtures 11 筆，provider calls=0，accuracy/inputTokens/outputTokens=null。
- 付費腳本未帶 live 參數會回報 NOT_RUN，在讀憑證及呼叫 API 前結束。
- 原始 D:\game-db-data 僅保留原有未追蹤的 %SystemDrive%/；未移除或改寫。

## 證據

最終機器報告：[report.json](../artifacts/browser/2026-09-29T10-41-05.155Z/report.json)。
報告中的 visualReview=PENDING 表示 runner 不會自行作視覺品質判定。

模型於本對話檢視的截圖：
- 第一輪工具驗證 2026-09-29T10-33-37.836Z：title、playing、paused、guard、musou、defeat 六張。
- 最終工具驗證 2026-09-29T10-41-05.155Z：musou、defeat 兩張再確認。
- 可見標題按鈕、暫停面板、守勢提示、無雙提示與敗北/再戰面板。
- 未把此有限截圖檢視標為完整美術、穿模、音效或手感通過。

[最終無雙截圖](../artifacts/browser/2026-09-29T10-41-05.155Z/05-musou.png)、
[最終敗北截圖](../artifacts/browser/2026-09-29T10-41-05.155Z/06-defeat.png)、
[離線 fixtures](../artifacts/jev-dry-run.json)。

artifacts 已被 Git 忽略，保留在本次 worktree；不會隨普通 commit 傳到其他機器。
若要分享證據，需要另行明確選擇這些無憑證的輸出檔。

## 未驗證與後續

Jev 真實 API、中文路由品質、信心門檻校準、供應商實際 token/帳單、
大型模型基準、完整 A/B/C 比較及故障漏報率尚未驗證。
不能宣稱 Jev 已提升速度、降低 token 或提升準確率。
付費呼叫需依使用者提供的 Shared Agent Core「financial actions」及
Local development permissions 取得具體授權，並由本地安全機制提供憑證。
候選下一步為 11 案例 × 三輪、最多 33 次、預留 USD 0.10；詳見
[重跑與比較方法](testing-efficiency.md)。

本次沒有 commit、push、PR、部署或排程。測試所啟動的 Chrome 與 Vite 均已結束。
