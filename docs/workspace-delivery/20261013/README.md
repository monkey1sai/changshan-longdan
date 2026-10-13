# 2026-10-13 工作區 Git 交付

本交付保存 `C:\Repos\changshan-longdan` 的程式、SPEC、歷史分支、未提交工作與遊戲驗收證據，供移除 Codex sessions 後接續。這是備份交付，不是 Unity 移植驗收完成。

## 保存範圍

- 最新工程基準：`afea710ddcac89ef4bc67d41489fc9f32113443c`。
- 原有 8 個尚未推送分支，另以 `archive/workspace-20261013/*` 保存 34 個 clone HEAD／獨有本機 ref。精確對照見 `clone-refs.json`；各分支保留自己的歷史，未合併 main。
- 48 個 repo／clone 的檔案盤點在 `manifest.json`，其中 7 個 dirty clone 的 staged／unstaged 差異分開保存於 `dirty/`。原 checkout、index 與工作檔未改寫。
- 38,546 個非快取檔案的原始內容，去重後以 5,113 個文字物件與 2,214 個遊戲媒體／Player build 物件保存。14 個分片共 558,540,276 bytes；每片小於 40 MiB 或等於 40 MiB。
- 保留舊交接紀錄、檔案雜湊索引、清理提案與失敗紀錄於 `prior-handoff-20261011/`。該目錄內腳本只供歷史稽核，未因本次交付重新執行。
- 舊 E11 審查 ZIP 的全部非快取成員可依內容 SHA 對應本快照；唯一未重複的 `manifest.json` 另存為 `prior-e11-review-kit-manifest.json`。內含官方套件快取及原 ZIP 包裝副本不重複上傳。

## 排除及限制

不公開本機 agent／Jev／憑證設定，不備份可重建的 node_modules、Unity Library／Temp／Obj、dist、套件快取與 Git 內部設定。根目錄 `.claude/launch.json` 保留本機、未讀入此次公開候選；其他排除路徑列於 `manifest.json`。舊 4.7 GB tar 與 Git bundle 保留本機，其有效 Git 歷史及非快取工作內容由本次 refs／快照保存；不把含 Git 設定的舊 tar 整包公開。

有限秘密樣式掃描不是完整秘密檢出證明。原始遊戲媒體與 Windows Player build 已取得使用者公開同意；沒有宣稱完成 OCR、執行檔安全稽核或遊戲測試。二進位／容器格式與路徑檢查、雜湊及來源紀錄分開保存。

本資料不包含完整 Codex 對談 JSONL，也不修改 App session 資料庫。移除 session 不等於刪除 repo；不要把這份交付當成刪除整個本機工作區的批准。

## 驗證

- `branch-scan.json`：227 個尚未公開 blob、60 個 commits；有限樣式掃描無命中，設定／憑證路徑先擋下再讀檔。
- `binary-object-review.json`：4 件歷史遊戲模型／PDF 的來源與格式檢查，未執行內容。
- `text-encoding-check.json`：5,113 個實際文字物件均無 UTF-16 BOM；嚴格文字解碼及 NUL 檢查另已執行。
- `candidate-validation.json`：7 個 dirty clone 的 HEAD、status、兩份 patch 無漂移；4 個 ZIP 的所有成員路徑含目錄均再次驗證。此後驗證明確區別於打包時的檢查版本。
- `restore-validation.json`：實際還原結果；只能依此檔的狀態判定是否通過。還原檔案不等於還原 Git index、Unity 安裝或通過 runtime 驗收。

## 還原與接續

先取得本交付分支。執行 `python docs/workspace-delivery/20261013/restore-files.py C:/Repos/changshan-longdan-restored`，目標必須是尚不存在的新目錄，且父目錄已存在。工具核對分片與每個檔案 SHA，不覆寫既有檔案，也不執行其中程式。

這份檔案快照沒有 `.git`；原 clone／worktree 的 Git 歷史請從對應遠端分支另外建立。dirty clone 先在原 HEAD 建立新 checkout，核對 `manifest.json` 的 status，再依需求套用 `dirty/` 的 staged 與 unstaged patch，避免覆寫現有工作。原始工作檔內容亦在快照中。

Unity migration followup SPEC 維持 **4/22（18.2%）**。E12 正式效能分級、30 分鐘長測及 E13 完整 Unity 遊戲驗收仍未完成；既有 Player 時鐘實測預算與失敗不能重設。下一個工程工作是原生 PDH ABI／mock 接線方案與審查；實際 provider／Player 執行仍需具體額度授權。此回合沒有啟動 Unity、Player、provider 或發布遊戲。

交付 commit 與遠端結果須以實際 Git SHA／`ls-remote` 回讀確認。此文件不把本機 commit 宣稱成已推送，也不授予 merge／部署／歷史改寫／刪除權限。
