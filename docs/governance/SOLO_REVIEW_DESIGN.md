# 單人維護審查與合併設計：方案 A

版本：v1。方向依據：維護者於 2026-10-15 選擇方案 A，並授權準備本地設計文件與導入檢查表。

狀態：**DESIGN_ONLY / NOT_EFFECTIVE / NOT_IMPLEMENTED**。方向已選定，具體導入候選仍待現行門檻核准。本文件是正式設計記錄，不是生效的規則、設定、審查核准或操作授權。

本輪只新增本文件與[導入檢查表](SOLO_REVIEW_ADOPTION_CHECKLIST.md)，不修改 `AGENTS.md`、workflow 或 GitHub 設定；不建立 App、設定秘密、stage、commit、push、建立或合併 PR。既有證據、所有還原備份及其他工作區保持保留。

## 1. 目標、適用範圍與現況

目標是在只有一位日常維護者的 repo，保留隔離開發、非實作者的獨立審查、同版本驗收、維護者本人在 GitHub 的正式人類核准，以及可追溯的交付與收尾。

適用 repo：`monkey1sai/changshan-longdan`；目標分支：`main`；主工作區：`C:\Repos\changshan-longdan`。本次文件 worktree 為 `.worktrees/solo-review-design-20261015`，本機分支為 `codex/solo-review-design-20261015`。

以下是 **2026-10-15 05:27 UTC 附近的唯讀快照**，導入或交付前須重新查核，不能直接沿用為當時的證據：

| 項目 | 已讀回的狀態 |
| --- | --- |
| 基準 `origin/main` 與遠端 `main` | `3a7e0a008b8a03f7c40e658a576706ce082caff8` |
| repo / 協作者 | 公開、個人帳號持有；前次完整協作者查核僅 `monkey1sai`（admin）；本輪未重查協作者清單 |
| `main` | `protected=false`；有效 branch rules 為空 |
| Actions workflow 權限 | `default_workflow_permissions=read`；`can_approve_pull_request_reviews=false` |
| 現有 workflow | [Game CI](../../.github/workflows/ci.yml)，Ubuntu / Windows 矩陣 |
| 現有文件規則 | [AGENTS.md](../../AGENTS.md)；必要人類核准、獨立審查、驗收及有效重試上限仍適用 |
| PR #47 | OPEN，作者 `monkey1sai`，兩個 CI SUCCESS，`reviewDecision` 空白，auto-merge 關閉 |
| PR #7 | OPEN / draft，作者 `monkey1sai`，目標 `main`；本輪未評估其產品驗收或合併就緒程度 |

目前的具體阻礙是：GitHub 不允許 PR 作者核准自己的 PR；現有核准門檻不能由 AI advisory、一般留言或維護者的另一個帳號替代。[S1]

## 2. 責任與信任邊界

| 角色 | 責任 | 不得替代的責任 |
| --- | --- | --- |
| 實作者 | 在專用 worktree 修改、測試與整理候選；依當次具體授權推送 feature branch | 不審查自己的修正，不自行宣告人類核准 |
| PR 建立 App | 使用 installation 身份，為已推送的指定分支建立 PR 並讀回身份與版本 | 不推送程式、不送 review、不處理討論、不合併、不管理設定 |
| 獨立 reviewer | 未參與實作的唯讀 reviewer，檢查完整 diff、source、tests、規格及證據，記錄結論 | advisory 不算 GitHub 人類 approval；不得接受自己修正後的候選 |
| 維護者 `monkey1sai` | 親自核對驗收與審查，對目前 head 在 GitHub UI 提交正式 Approve | 不以 CI、App 身份或簽到留言代替判斷 |
| 交付操作方 | 在當次授權內重新讀回門檻，合併、確認遠端、同步與安全清理 | App 安裝或本設計不提供永久 push / merge / delete 授權 |

這保留一位真實人類的最終核准與獨立 AI 審查，沒有提供第二位獨立人類。任何現行規範要求的獨立人類、專項簽核、必要模型或品質門檻都繼續適用；缺少時維持 HELD。

## 3. GitHub App 最小權限

第一版 App 僅建立 PR。程式推送繼續使用既有、經具體授權的 Git 認證，不交給 App。

| 範圍 / repository permission | 設計值 | 理由 |
| --- | --- | --- |
| Installation repository selection | 只選 `monkey1sai/changshan-longdan` | 不授予全部 repositories |
| Metadata | Read | repository 識別 |
| Pull requests | Read & write | 建立 PR 及讀回候選；建立 API 必要權限 [S2] |
| Contents | Read | 核對來源分支、SHA、內容；不授予 write |
| Actions / Checks / Commit statuses | No access | App 不執行 CI、不寫檢查結果 |
| Administration / Workflows / Secrets / Environments / Deployments / Issues / Members 等其餘可選權限 | No access | 不管理保護、秘密、協作者、workflow 或其他資源 |
| Account / organization 權限 | No access | 第一版沒有此需求 |

採 installation token，活動明確歸屬 App；不使用 user access token、維護者 PAT、假人帳號或退役的自動 counted approval。App ID、installation ID、repository ID 及 action 完整 SHA 在導入時查核，這裡不虛構值。

installation token 限單 repo 與上述權限，短效、完成後撤銷。App 私鑰另有輪替與疑似外洩時停用程序；撤銷單一 token 不會撤銷私鑰。[S4]

**權限限制與程式行為限制須分開記錄。** `Pull requests: write` 也涵蓋 review 等 API，不能宣稱 token 技術上只有 create 能力。PR 建立器的 API allowlist 是已審程式的行為限制。缺少 `Contents: write` 不符合已核對的 REST merge endpoint 權限，但不能把它擴張成「App 不可能造成任何寫入」。[S2][S3]

## 4. 受控的 PR 建立器

擬新增 `.github/workflows/open-task-pr.yml`，以下是設計，不是已建立的 workflow：

1. 僅 `workflow_dispatch`，執行 ref 必須為 `refs/heads/main`；啟動者須為維護者的已核對數字 ID。第一版限定 `run_attempt == 1`，拒絕 rerun；重試須重新 dispatch 並重新查核 tuple。後續若支援 rerun，須另驗 `triggering_actor`，不能只沿用原 `actor`。[S8]
2. 僅在經核准、受保護的 main workflow 版本執行；記錄並核對 workflow SHA / 腳本 SHA。主分支或預期 base 漂移即 HELD。第一版優先純 API 操作而不 checkout；若需要 checkout，必須固定已核准 SHA，不使用浮動 main。
3. 使用獨立的 GitHub-hosted 臨時 runner；不與候選共用 self-hosted runner。所有 `uses:` 固定已審完整 SHA，不執行候選分支、local action、套件安裝、cache 或 artifact。
4. 擬設 Environment `pr-author-main`，只允許 Selected branches and tags 中的 Branch `main`，不允許 tag 或 `refs/pull/*/merge`；不以 Protected branches only 代替。禁止環境管理員 bypass，實際可用性須驗證。此 Environment 不另設一道人類 reviewer 票，正式人類核准發生在 PR UI。
5. App 私鑰只由維護者經支援介面存入該 Environment secret，擬名 `SOLO_PR_APP_PRIVATE_KEY`；App ID 使用非秘密變數，擬名 `SOLO_PR_APP_ID`。不放 repository-level secret、工作區、參數、log 或 artifact。`GITHUB_TOKEN` 維持 `contents: read`，不開啟 Actions 自動核准選項。
6. **Environment 限 main 不等於只限本 workflow。** main 上所有能引用 Environment 的 workflow 都納入信任範圍；`pull_request_target` 也可能使用 base ref。禁止 PR / PR-target job 引用或傳遞此 Environment / secret，不在特權流程 checkout PR 或執行 PR artifact。[S6][S8]
7. 預檢通過後才 mint App installation token，使用已審查的 GitHub 官方 token action；精確 action SHA 在實作前核對。token 只在建立器 job 內使用，用完撤銷；不輸出完整 contexts、token 或私鑰。

建立器介面與拒絕條件：

| 項目 | 設計契約 |
| --- | --- |
| 固定目的地 | 核對 repository ID 及名稱，base 固定 `main`；不接受任意 URL 或 API proxy |
| 分支 | 同 repo、精確的當次授權 `codex/…` 分支；前綴本身不是授權 |
| 版本 | 輸入預期 base/head，向 GitHub 讀回比較；PR 建立後再讀回作者、base/head |
| 作者 | 必須是指定 App 的 installation 身份，不以 commit 作者欄位作證明 |
| Payload | 標題、本文、branch 及事件欄位全作資料處理，不插入 shell 程式碼 |
| 可用操作 | 建立 PR 及必要 metadata / branch / PR 唯讀端點 |
| 禁止操作 | review、dismiss、resolve、merge、branch update/delete、規則及秘密管理 |
| 重複 / 重放 | 認證呼叫者、記錄 run/request ID；同分支既有 PR 讀回後回傳，衝突不重複建立 |
| 漂移 / 不明結果 | HELD，保存讀回證據；不自動刪 PR 或 branch 收尾 |

開 PR 前的 SHA 核對不能原子鎖住遠端 branch；建立後讀回與後續交付重核均不可省略。App PR 的 CI 觸發須實測；不得只看到 PR 建立成功便推定 CI 已執行。[S7]

## 5. 獨立審查、人類核准與驗收

候選證據至少綁定 repo、PR、完整 base/head、完整 changed files、實際測試 checkout SHA、適用 profile / asset 版本、reviewer 身份及結果。審查者須讀原始來源，不只採信實作者摘要；PR 本文、留言與 artifact 均視為未信任資料。

修正後重新綁定適用審查與驗收；不能沿用舊候選的 approval、影片或 CI 冒稱新版通過。保留現行較嚴的兩次失敗修正上限與已消耗輪數，不因換 agent、分支或方法重算。確認的 HIGH / CRITICAL、必要證據缺失或審查能力不足均阻擋交付。

維護者在 GitHub UI 閱讀完整 diff 及證據後，對當前 head 提交正式 Approve。讀回須確認數字 user ID、非 bot、有效最新 review、`commit_id == head`、未 dismissed，以及 `reviewDecision=APPROVED`。App approval、一般留言、Viewed、pending review、CI 或本機 advisory 皆不替代。若平台或政策限制維護者對實際 App-authored PR 的核准，維持 HELD，不改身份繞過。[S1]

產品驗收依 [AGENTS.md](../../AGENTS.md) 與任務適用 SPEC 執行；保留 S01-S08、數值門檻、同版本及人類感官要求。這份治理設計不改動遊戲變數，也不證明 Unity 或 web runtime 完成。NOT_APPLICABLE 須依現行規則有經審查理由，不能用來豁免承諾的驗收。

## 6. CI 與主分支保護設計

沿用 [Game CI](../../.github/workflows/ci.yml) 與 [package.json](../../package.json)：兩平台 locked dependencies、`npm run check`（Vitest + TypeScript / Vite build）、E01 trace、artifact、itch package 驗證及 tracked files unchanged。補記 PR base/head 與 `git rev-parse HEAD`；PR CI 可能 checkout 測試合併提交，不把 run head 欄位當實際 checkout SHA。

兩個矩陣 job 都必須實際執行且結論 SUCCESS；GitHub 原生 required check 可接受的 skipped / neutral 不等於本 repo 的 PASS。workflow 與 package scripts 也納入完整 diff 審查，避免弱化測試。既有 artifact retention 為七天；必要證據到期前另存 worktree 外、可驗證還原的長期保全位置，不能只留會過期的連結。

| 擬啟用的 main 規則 | 設計值 / 原因 |
| --- | --- |
| Required PR review | 至少一個有效 approval |
| CODEOWNER | 擬新增 `.github/CODEOWNERS`：`* @monkey1sai`；啟用 `require_code_owner_reviews=true`，涵蓋所有檔案及 CODEOWNERS 本身 |
| Stale approval | 新變更造成舊核准失效；完整 base/head 漂移仍由交付方重新核對 |
| Required status checks | 精確 `check (ubuntu-latest)` / `check (windows-latest)`，驗證 GitHub Actions 來源，strict up-to-date |
| Conversation resolution | 所有必要討論已處理，交付前完整分頁查核 |
| Bypass / destructive operations | 規則適用管理員；App 不列 bypass；不允許 force push 或刪除 main |
| Auto-merge | 維持關閉 |
| Last push approval | 第一版不新增「最近 push 必須由另一人核准」；owner 仍推 feature，新增此條件會造成單人阻擋。若已有更嚴規則則 HELD，不關閉它 |

以上目前都不是生效設定。GitHub 的 CODEOWNER 使用 base branch 版本；首次啟用順序與舊 PR 過渡必須依第 8 節處理。[S5][S9]

強制邊界：GitHub 伺服器承擔 PR / CODEOWNER review、required checks 等原生規則；維護者人工承擔獨立 review 身份、實際 SUCCESS、產品驗收與證據完整性核對。第一版沒有自製安全 gate，不宣稱缺 runtime / AI review 證據時 GitHub 一定拒絕 merge。

## 7. 正常交付、保全與停用

順序為：主工作區同步 → 任務 worktree → 實作與驗證 → 授權推送 feature → App 建 PR → 獨立完整審查與適用驗收 → 你的 GitHub 人類核准 → 重新核對所有門檻與當次合併授權 → 標準合併 → 遠端驗證與 post-merge 檢查 → 同步主工作區 → 保全並清理本任務 worktree。

合併前凍結被審 tuple，重新讀回最新 base/head、CI、有效人類 review、完整 threads、mergeability、保護設定及相依條件；未知或漂移時不合併。`--match-head-commit` / merge API `sha` 僅綁定 head，不證明 base 沒變。不用 admin、force 或 auto-merge bypass。

完成須證明 PR 已 MERGED、base 為 main、遠端合併提交可由更新後 origin/main 到達；squash / rebase 另核對實際交付內容。只允許安全 fast-forward 主工作區；分歧或會覆寫 dirty 內容時保留並回報。

清理前重核路徑、HEAD、合併證據及 staged / unstaged / untracked / ignored；需保留的內容先備份到待刪目錄之外，記錄版本與雜湊並驗證還原。有新變動即保留。僅移除本任務 worktree，不帶 `--force`，保留所有既有證據、還原備份及其他工作區；未合併的本地文件 worktree 不因文件寫好就刪除。

疑似私鑰外洩、App 超權、錯誤 author、假核准或候選取得秘密時，停止建立器與交付，保存不含秘密的稽核資料，由維護者在另行授權內停用 App / 撤銷及輪替；不以放寬規則或人類 PAT fallback 恢復。新程序失敗不授權 reset、強制合併或覆寫既有文件；保留舊流程的 HELD 狀態及必要獨立審查。

## 8. 首次核准與 PR 過渡

**方向選擇、本地文件可讀及獨立 AI 審查，都不等於首次人類核准。** 目前未確認有另一位合資格人類；外部 reviewer 必須實際閱讀候選，取得可計入的必要權限並親自送出 review。不能由新 App 批准首次導入，也不能為逃避 hold 而重開 PR 換作者。

建議順序：外部人類資格與權限確認 → 按舊規核准 / 處理 #47 及首次導入治理候選 → 維護者另授權啟用 App / Environment / 保護設定 → 正負驗證 → 常態採用。若現行門檻無法成立，保持 HELD；不先啟用只由 owner 核准的 CODEOWNER 要求，再用 bypass 解開 owner-authored PR。

| 候選 | 日期快照與過渡安排 |
| --- | --- |
| [PR #47](https://github.com/monkey1sai/changshan-longdan/pull/47) | 作者 owner；base `3a7e0a008b8a03f7c40e658a576706ce082caff8`；head `b566be1a624cb4d64fe85e07632507c004abc273`。兩 CI SUCCESS，仍缺有效人類核准。本輪保留 OPEN 及既有 worktree。後續在新 owner-only CODEOWNER 要求啟用前，由外部人類依舊規核准，再於有效授權及全門檻成立時處理；不修改作者、不重開來解鎖，不借其 CI 支持新文件候選 |
| [PR #7](https://github.com/monkey1sai/changshan-longdan/pull/7) | OPEN / draft，作者 owner；分支 `codex/preserve-live-character`；head `2f14f7038d0f0a99ca94e1295842f32682c04c2a`。不推定 runtime / 資產 / 合併就緒，不解除 draft、不關閉或合併。啟用 owner-only CODEOWNER 後 owner 仍不能自批；須事先記錄「另案依舊規處理」或「保留 draft / HELD，未來另有正式過渡決策」；不能暗中重開換作者或臨時放寬保護 |
| 本次設計文件 | 新本地分支、基於 main，不堆疊 #47。沒有 stage / commit / push / PR。日後若要送審，須重新核對基準、凍結候選並依當時有效規則及具體授權辦理 |

沒有外部首次 reviewer 時，仍可完成本地設計，但不能宣稱已導入或開始正常合併。採用 owner-only CODEOWNER 後，人類 owner 直接建立的新 PR 也會受此限制；正常流程必須由正式 App 建 PR。

## 9. 導入前尚缺條件與殘餘風險

尚缺：首次人類 reviewer 與授權、#7 過渡決策、長期證據位置、實作候選及獨立審查、實際 App/action 版本、Environment / broker / owner approval 的正負驗證。逐項狀態見[導入檢查表](SOLO_REVIEW_ADOPTION_CHECKLIST.md)。

維護者仍能修改設定；main workflow、第三方 action、runner 或 owner 帳號遭入侵可能暴露私鑰。Environment 的 ref 限制、CODEOWNER、最小權限及獨立審查降低風險，不提供絕對保證。獨立 AI 也可能與實作者犯相似錯誤，不能補足缺失的實測或第二位人類。`Contents: read` 仍能讀取誤提交到 Git 的秘密，不能宣稱 App 無法讀到任何秘密。

## 10. 官方來源與版本查核

以下官方資料於 2026-10-15 本次設計討論查核；平台行為仍須於導入時以實際配置驗證。文件參考不代表設定已存在或生效。

- [S1：人類核准、作者限制](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews)
- [S2：建立與合併 PR 的 API 權限、head SHA 條件](https://docs.github.com/en/rest/pulls/pulls)
- [S3：review API 權限](https://docs.github.com/en/rest/pulls/reviews)
- [S4：GitHub App installation 身份與短效 token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [S5：branch protection、stale approval、last-push 與 required checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [S6：Environment secret / ref 限制](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [S7：GITHUB_TOKEN 與 workflow 觸發](https://docs.github.com/en/actions/concepts/security/github_token)
- [S8：actor、triggering_actor、workflow SHA 等 contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)
- [S9：CODEOWNERS 來源與作用](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
