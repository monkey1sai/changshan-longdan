# E12 REA 靜態支持工具：逐步紀錄

依 `MUSOU_STEP_RECORD.template.md` 分列；不是新的 E12 實測批次。

## A. 開始前範圍審查

- implementer：Codex 主控；independentReviewer：`/root/unity_spec_review`。
- base：`b5354382662ffe8cfaaf005601c00f442c793401`，隔離分支 `codex/unity-e12-capability`，開始時 clean。
- 使用者要求：將 REA 套用 fork 遊戲 repo 的未完成 SPEC；採 `unity-migration-followup`。
- 允許：`tools/rea/package.json`／lock、本文件與 `REA_SPEC_SUPPORT.md`、原 design／tasks 的支持方法說明。
- 禁止：runtime／profile／asset／22 checkbox／門檻修改，全域或 `.codex` 配置、skill 安裝、Unity／Player／CIM／PDH／native capture、push／merge／發布。
- changedVariableIds：V10／V12 的證據調查流程；S05 量測前置支持。沒有修改變量值或執行 S01–S08。
- preImplementationReview：獨立 advisory accept；親讀 SPEC、npm 6.4.0 CLI／managed routing／static provider，重算 tarball integrity；同意有界離線整合，不等於 formal APPROVED。
- mergeAuthorization／paidActionAuthorization：無。本次不使用任何實測窗口。

## B. 候選版本與環境

- Node 22.22.0；REA `rea-agents@6.4.0`、MIT；獨立 npm lock，`npm ci --ignore-scripts --no-audit --no-fund`。
- artifact 絕對路徑、bytes／前後 SHA、MVID、來源／build UNKNOWN 與 raw hash 見 `REA_SPEC_SUPPORT.md` 及 `release/rea-spec-support-v1/run.json`。
- artifact 所有祖先無 reparse point；未執行 DLL。硬體／driver／viewport／品質參數：本次沒有量測，不能據此給正式效能結論。
- 原始 stderr 保存 npm proxy／Node 實驗性 proxy 警告；不修改 TLS、代理、ACL 或安全設定。

## C. 驗證矩陣

| 檢查 | 命令／證據 | 結果 |
|---|---|---|
| 固定版本與安裝 | npm lock、`npm ci --ignore-scripts`、CLI `--version`、`npm ls --depth=0` | PASS，6.4.0／144 packages |
| 正例：身分 | `inspect-managed-artifact <Foundation.dll> --format json` | PASS，exit 0／complete |
| 正例：member | `inspect-managed-members <Foundation.dll> --format json` | PASS，exit 0／complete，11 types／23 methods |
| 負例：缺檔、非 managed | 同一 artifact CLI，指定 missing path／tools manifest | PASS，均 exit 1／target_unavailable |
| 邊界：截斷 | 同一 CLI，指定僅 2 bytes `MZ` 的新 fixture | PASS，exit 1／target_unavailable |
| 結果／身分核對 | JSON error、provider、subject／artifact SHA、coverage／limitations、輸入前後 hash、lock integrity | PASS；初次 PS lock 解析錯誤修正後通過 |
| OpenSpec strict／diff／22 計數 | `openspec validate unity-migration-followup --strict`、`git diff --check`、tasks checkbox 計數 | PASS，4 completed／18 remaining，原 22 項未改 |
| Unity compile／Edit／Play／build／Player、真實時鐘 | 本次沒有執行，也無新增預算 | NOT_RUN |
| render／自然操作／音效／實體手把／正式 E12／soak／E13 | 本次不是該單元驗收 | NOT_RUN，原必要 gates 保留 |

raw：`release/rea-spec-support-v1/`，local_only，summary 記各 raw hashes；完整分析輸出與 DLL 不公開提交。

## D. Commit 與審查閉環

- exact-candidate review：待獨立核對最終 commit，結論保存 local_only evidence；不把 draft／scope review 當正式批准。
- formalIndependentReview／GitHub CI／merge／postmerge：NOT_RUN。
- 回復：以普通 revert 本次 scoped commit 回復工具／文件；原程式 checkpoint、Git 歷史與失敗 raw 保留，不 reset／clean。

## E. 完成與下一步門檻

- stepVerdict：STATIC_SUPPORT_IMPLEMENTED；不標 E12 VERIFIED／DONE。
- SPEC：4/22（18.2%），本次沒有完成任何原 task checkbox。
- 缺口：當前 code／完整 Player build 對應、Character DLL、WMI producer 根因／時鐘、原必要 runtime 與 formal gates。
- 下一步仍為 2.1 版本可追溯產物與新定位證據；不得進正式 E12／E13。REA 不控制 Unity、不替代 Jev Choice 或完整遊戲驗收。
