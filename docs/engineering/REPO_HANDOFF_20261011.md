# 2026-10-11 Git 交付與本機清理交接

## 工作狀態

Unity migration followup SPEC **4/22（18.2%），未完成**。本交付保存未完成成果，不構成任何實作單元DONE、正式GitHub APPROVED、main合併、遊戲發布或Unity完整遊戲驗收。

最新程式checkpoint `784c0ebd9919c11836c49bd4e7645f4ba0e9152d`：離線錯誤資料保存能力，E12離線49/49 PASS，獨立exact-SHA advisory審查接受。真實WMI逾時根因UNKNOWN、clock mapping UNVERIFIED；正式E12分級／30分鐘長測／E13完整自然操作均未完成。既有失敗與實測額度不得重設；新增實測授權0。完整工作紀錄見 `UNITY_E12_CAPABILITY_STEP_RECORD.md`。

## Git 交付範圍

目的地：既有 `origin`／`monkey1sai/changshan-longdan`（公開repo）。保留原分支與歷史，只做新增或fast-forward推送；不force、不改寫歷史、不直接合併main、不刪遠端分支、不發布itch。

下列8個本機分支含尚未公開的歷史成果；交付不表示各分支皆已通過遊戲驗收：

| 分支 | 盤點時HEAD |
|---|---|
| claude/docs-mmorpg-sources | 8a9a703f8e3a302bb7e66c13a298c16f6b121287 |
| codex/e12-performance | 3f45d134da9b6ca997e1de0c8b5b2a2eec60c447 |
| codex/fix-zhaoyun-deformation | fb7e7cd7ab8f116530ca488bb020bcb12be2f557 |
| codex/p0-local-integration | c69474c74f29bb15122c23cc265592799d0aa1cd |
| codex/session-records-20261008 | b92e0e71cc066c970d078f62750c12f7e85d1d51 |
| codex/spec-zhaoyun-deformation | 0aaf40f8bcfbaae846a1d20d07a669026aa8d1c9 |
| codex/unity-e12-capability | 784c0ebd9919c11836c49bd4e7645f4ba0e9152d（本交接文件另commit） |
| codex/unity-e12-capability-validate | 2329b486c6dd1942acab4d415792e51a5aa45d25 |

Web保留tag `itch-web-2026-10-02` 已推送並經ls-remote確認：annotated tag `220463bcc90b5b8f776e6b489db4e6f618148706`，來源commit `c48ecd9a39abbc42ecf34ed3761248e11af7c29d`。來源已在origin/main歷史；沒有重新驗證公開itch包。現有CI只在main push／main PR／手動執行觸發，本tag不觸發CI，CI=NOT_RUN。

分支交付前尚待限定本機秘密樣式掃描批准及結果。自動批准審查拒絕首次掃描，理由為可能接觸敏感資料、現有授權未明確涵蓋；未繞過。沒有讀repo外憑證，沒有把原始驗收log、影片或本機封存上傳公開repo。交付結果以實際remote SHA readback為準，不以本表或預期push代替。

## 本機備份與清理界線

使用者選擇：「保留Git歷史，清理本機暫存與已備份工作目錄」。盤點48repo：本repo內46個歷史工作目錄＝16個registered worktree＋30個standalone clone，另有root及1個workspace外repo。40個可重建cache合計28,626,088,558bytes，全部位於`.worktrees`；root沒有node_modules。7個舊clone有dirty修改，不可當成可直接刪的暫存。

本機備份位置 `release/handoff-20261011/`（ignored；不發布）：

- `inventory.json`：路徑、HEAD、branch、dirty、cache與證據大小。
- `all-refs.bundle`：115refs、完整Git歷史，bundle verify PASS；148,323,109bytes，SHA256 `70da902e36192be855eb3db54f093463a41cad7d98aa7fdf885717681b8d4c3b`。這是盤點時快照，之後新增的交接commit另以Git保存。
- `worktrees-with-evidence.tar.gz`：封存全部`.worktrees`與`.claude`，只排除inventory明列40個cache；保留release/logs/screenshots/影片、dirty working files、clone完整.git及registered worktree舊pointer。封存與逐檔驗證結果待實際完成後登錄。
- `cleanup-plan.json`：固定37目錄＝14個clean registered worktree＋23個clean clone；SHA256 `90f46e937675e5696f2ddabe82c360ce3509573d640e4eea40f7aa77b20c137e`。狀態PROPOSED_NOT_APPROVED，尚未刪除。

保留`.git`、`.claude`、`release`、全部本機branches/tags、`.worktrees/_evidence`、7個dirty clone、unity-e12-capability／unity-e12-capability-validate及workspace外repo。不遞迴刪整個`.worktrees`。固定清單須經人類批准、公開交付確認、完整封存逐檔驗證、獨立風險審查，執行前再核對path/reparse/HEAD/status/活動寫入；任何漂移即停止。

## 還原方式與限制

主repo `.git`與所有refs保持原樣，必要時可由bundle還原Git物件。registered worktree的舊`.git`是pointer，不能把tar解壓後就當作完整恢復；須先在空目標依inventory重建worktree（原branch空閒時掛回原branch；否則`--detach`在原HEAD，並明記分支掛接差異），再從archive覆蓋還原該目錄檔案、排除其舊`.git`pointer。standalone clone包含完整.git，沒有alternates/commondir，可向空目標還原。檔案或新修改已存在時停止，不能覆寫。

封存驗證必須檢查所有一般檔與hardlink內容hash；hardlink僅接受archive內已核實的先前目標，拒絕absolute／`..`／外部或未驗證目標；symlink先fail-closed，不能略過便宣稱完整恢復PASS。備份未完整驗證或缺必要批准時，只交付可獨立且已授權的成果，不執行清理。
