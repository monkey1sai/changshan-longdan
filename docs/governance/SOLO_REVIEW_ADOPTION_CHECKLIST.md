# 方案 A 導入檢查表

配套設計：[單人維護審查與合併設計](SOLO_REVIEW_DESIGN.md)。日期：2026-10-15。

狀態：**DESIGN_ONLY / NOT_EFFECTIVE / NOT_IMPLEMENTED**。本檢查表記錄未來導入條件，不授予執行權限。這次只準備本地文件，不建立 App / Environment / workflow / CODEOWNERS，不改 GitHub 設定，不 stage、commit、push 或合併 PR。

`[ ]` 代表尚未驗證完成，不代表失敗；另以 NOT_RUN、HELD、FAIL、PASS 記錄真實狀態。不得因本文件存在就勾選完成。凡必要項目缺失、未知或失敗，停止受影響階段；獨立且已授權的準備可繼續。

## 1. 當前阻礙與版本

| 項目 | 本輪快照 / 初始狀態 | 解除條件 |
| --- | --- | --- |
| 首次人類 reviewer | HELD：尚無已確認的外部人類 reviewer | 真實、非作者、具有效資格，閱讀完整候選並在 GitHub UI 核准 |
| App / broker / Environment | NOT_RUN | 獨立審查、具體建立 / 設定授權、正負驗證 |
| main 保護 | 未啟用，rules 為空 | 首次導入順序成立後另授權啟用並讀回 |
| #47 | OPEN；head `b566be1a624cb4d64fe85e07632507c004abc273`；兩 CI SUCCESS，核准缺失 | 依現行規則重新核對與外部人類 approval；另行授權處理 |
| #7 | OPEN / draft；head `2f14f7038d0f0a99ca94e1295842f32682c04c2a` | 正式過渡決策；不推定產品完成、不自行解除 draft |
| 文件基準 | `3a7e0a008b8a03f7c40e658a576706ce082caff8` | 送審 / 導入前重新查核最新 main |
| 長期證據位置 | HELD：尚未指定 | worktree 外、可保存必要內容並驗證還原的授權位置 |

日期快照與來源範圍見[設計第 1 節](SOLO_REVIEW_DESIGN.md#1-目標適用範圍與現況)。不把前次協作者查核、#47 的 CI 或舊審查沿用為未來候選證據。

## 2. 首次核准與過渡順序

- [ ] 維護者確認外部首次 reviewer 的真實身份、數字 GitHub user ID、非 PR 作者及可計入權限；必要邀請 / 權限變更另有具體授權。
- [ ] reviewer 實際閱讀完整候選、適用規格及證據；不是只代按 Approve，不能用 App、假人或退役 counted approval。
- [ ] #47 重新讀回 base/head、CI、完整 reviews / threads、mergeability、auto-merge、保護規則及當次授權；缺人類核准就保持 HELD。
- [ ] #47 在新 owner-only CODEOWNER 要求啟用前依舊規處理；不換作者重開、強制合併或用新制度追溯補票。
- [ ] #7 維持 draft；記錄另案依舊規處理，或保留 draft / HELD 並等待未來正式過渡決策。列清啟用 owner-only CODEOWNER 後外部一般 reviewer approval 仍不能代替 owner CODEOWNER 核准的限制。
- [ ] 首次導入治理候選含 workflow / CODEOWNERS / CI / 權限方案，完成獨立審查及舊規所需人類核准；新程序不得批准自己。
- [ ] 先完成被 owner-only 要求阻擋的首次導入候選，再另授權啟用該要求；未解舊 PR 的處置有紀錄，不用 bypass 解鎖。
- [ ] 每次 GitHub mutation 的 Destination、Purpose、Allowed operations、Data、Forbidden operations、Stop conditions 已記錄；方向選擇不替代具體操作授權。

## 3. App 註冊、憑證與 PR 建立器

- [ ] 在具體授權後才註冊 / 安裝 App；範圍僅本 repo，記錄實際 App ID、slug、installation ID、repository ID。
- [ ] 讀回權限：Metadata read、Pull requests write、Contents read；其餘可選 repository / account / organization 權限不授予。
- [ ] 確認沒有 Contents write、Administration、Workflows、Secrets、Actions / Checks / Statuses write，亦無 bypass。
- [ ] 明列 Pull requests write 技術上仍涵蓋 review API；token 權限與建立器 API allowlist 分開記錄，不誇稱 token 只能 create。
- [ ] installation 身份 / token，無 user token / 人類 PAT fallback；單 repo、最小權限、短效且用後撤銷。
- [ ] 私鑰經支援介面存入 Environment secret；不在 agent、工作區、參數、log、repository-level secret 或一般 CI 暴露。
- [ ] 私鑰輪替、疑似外洩停用及保全程序完成審查；撤銷 token 不當作撤銷私鑰。
- [ ] 擬定的 `pr-author-main` 只允許 Branch main，不允許 tags / pull refs，不使用 Protected branches only 作替代；設定經 API / UI 讀回。
- [ ] 已驗證環境禁止管理員 bypass；不另設會造成單人 self-review 阻擋的 environment reviewer 票。
- [ ] 稽核 main 上所有可取得 Environment secret 的 workflow；PR / PR-target job 不引用或傳遞該 Environment / secret。
- [ ] `open-task-pr.yml` 僅 workflow_dispatch / main，核對啟動者數字 ID；第一版拒絕 rerun，重新 dispatch 前重核 tuple。
- [ ] 已核准的 workflow / 腳本 SHA 被記錄；不使用候選決定的版本清單，不執行浮動 main 或候選程式。
- [ ] 使用獨立 GitHub-hosted 臨時 runner；不共用候選 self-hosted runner，不安裝候選套件 / local action、不使用候選 cache / artifact。
- [ ] GitHub 官方 token action 的完整 SHA 已核對、固定；沒有為方案假設未確認的版本。
- [ ] 只有預檢通過才 mint token；`GITHUB_TOKEN` 維持唯讀，Actions 自動核准選項保持 false。
- [ ] 介面固定 repo ID / base main / 同 repo 精確授權 branch / 預期 base/head；前綴、標題或本文不被當作授權。
- [ ] Payload 當資料，無 shell injection / 任意 API proxy；只允許 create PR 與必要唯讀端點，禁止 review / dismiss / resolve / merge / delete / 設定管理。
- [ ] 重複請求與重放處理有測試；建立後讀回作者及 tuple，漂移 / 不明結果 HELD，不自動刪 PR 或 branch。

## 4. 主分支、獨立審查與 CI

- [ ] `.github/CODEOWNERS` 的 `* @monkey1sai` 及其自身保護已由首次候選按舊規審查；base branch 版本已核對。
- [ ] main 要求 PR、至少 1 approval、required CODEOWNER review、stale approval dismissal、討論處理、strict up-to-date。
- [ ] 精確 required contexts 為 `check (ubuntu-latest)` / `check (windows-latest)`，來源 GitHub Actions 已核對。
- [ ] 管理員也受 main 保護限制，App 不列 bypass，禁止 force push / main deletion，auto-merge 關閉。
- [ ] 第一版未新增 last-push-other-person 要求；沒有關閉既有較嚴規則，並明示本制度不提供另一人核准最近 push 的保證。
- [ ] 真實 App-author PR 上，owner 的 UI approval 可有效計入並滿足 CODEOWNER / reviewDecision；未通過則 HELD，不替換成假身份。
- [ ] 獨立 reviewer 未參與實作 / 自己的修正，讀完整 diff / source / tests / 規格；身份、base/head、問題處置、結論可定位。
- [ ] 審查能力、必要人類 / 專項 sign-off 與原有較嚴重試上限保留；實際消耗輪數不重設。
- [ ] CI 保留兩平台 npm ci / check、E01 trace / artifact、package 與 tracked-unchanged 檢查；workflow / scripts 的弱化也受審查。
- [ ] CI 證據記錄 head、base、實際 checkout SHA、run / job 身份及結果；兩矩陣 job 實際 SUCCESS，非 skipped / neutral。
- [ ] 適用 SPEC、S01-S08、profile / asset 版本、runtime / 畫面 / 自然操作 / 感官驗收完成；缺失保留 NOT_RUN / HELD，不以 CI 替代。
- [ ] 長期證據位置、內容雜湊及還原方法經確認；必要資料在七天 CI artifact 到期前保全至 worktree 外。
- [ ] GitHub 強制原生 review / checks，人工核對獨立 reviewer 與產品驗收；兩種控制的邊界清楚，不宣稱缺證據必由伺服器阻擋。

## 5. 正向、負向與邊界驗證矩陣

全部初始為 **NOT_RUN**。涉及外部寫入的測試須另有具體授權；拒絕路徑優先本機 / mock，需實際平台驗證時使用隔離環境。不在正式 main 試探預期會失敗的 push / merge，不讀出秘密作為拒絕測試。

| ID | 類型 / 情境 | 必須觀察的結果 | 初始狀態 |
| --- | --- | --- | --- |
| V01 | 正向：授權 branch、正確 base/head、owner 首次 dispatch | 建立單一 App-author PR，讀回 repo / base/head 正確；CI 確實觸發 | NOT_RUN |
| V02 | 正向：同候選獨立 review、適用驗收與 owner UI Approve | reviewer 證據有效；owner review 綁定 head 並滿足 CODEOWNER / APPROVED | NOT_RUN |
| V03 | 伺服器拒絕：缺有效 required human / CODEOWNER approval | 不符合 merge 門檻；不嘗試正式 main merge 驗證 | NOT_RUN |
| V04 | 伺服器拒絕：任一 required CI 失敗 / 缺失 | 不符合 merge 門檻；其他成功不得掩蓋 | NOT_RUN |
| V05 | 流程 HELD：缺獨立 review、runtime 或感官證據 | 人工交付檢查保持 HELD；不宣稱 GitHub 一定拒絕 | NOT_RUN |
| V06 | 邊界：新增 head、base 前進、測試合併 SHA 改變 | 舊證據不直接沿用，重新核對 / 更新受影響驗收；漂移不合併 | NOT_RUN |
| V07 | 邊界：錯 repo / fork head / 未授權 branch / 非 main / 非 owner | 建立器在 mint token / 寫入前拒絕 | NOT_RUN |
| V08 | 邊界：rerun、重放、重複或部分失敗 | 第一版拒絕 rerun；同候選不重複建 PR；不明結果保全並 HELD | NOT_RUN |
| V09 | 權限：App push / 已核對的 REST merge、管理規則或秘密 | 對應最小 token 不具所需權限；以隔離 / mock 驗證，不作正式破壞性試探 | NOT_RUN |
| V10 | review API 與人類身份 | 建立器拒絕 review 呼叫；App review 不採計為 owner 人類 approval；不聲稱 token 無 review 能力 | NOT_RUN |
| V11 | Environment / 特權流程 | 非 main ref 不得取用；PR / PR-target 不引用；候選、一般 CI、log / artifact 無 App 私鑰或 token 流入 | NOT_RUN |
| V12 | 不信任輸入：本文、branch、artifact、action / 腳本版本 | 不作程式執行；只跑已審查固定版本，不取得候選 cache / artifact | NOT_RUN |
| V13 | 用後撤銷、action 失敗、疑似私鑰外洩 | token 撤銷可核對；停止交付並走維護者授權的停用 / 輪替，不 fallback | NOT_RUN |
| V14 | 正向：另行授權的低風險試行交付 | PR MERGED / base main、遠端可達、post-merge PASS、主工作區同步、保全後清理本任務 worktree | NOT_RUN |
| V15 | 保全邊界：dirty / ignored 新成果、共享證據或備份不足 | 保留受影響 worktree、記錄 HELD；不 force / clean 或附帶刪除 | NOT_RUN |

GitHub-hosted runner、固定 action SHA、Environment ref 隔離與 reviewer 身份均未在本輪做寫入實測；文件完成不是這些控制的 PASS。

## 6. 每次候選的證據記錄欄位

| 類別 | 必填內容 |
| --- | --- |
| 身份 / 版本 | repo ID、PR、完整 base/head、實際 checkout SHA、profile / asset 版本、workflow / 腳本 / action SHA |
| 審查 / 核准 | 實作者、獨立 reviewer、review 範圍 / 結論 / 處置、owner user ID、有效 review ID / commit / state、完整分頁證據 |
| CI / 驗收 | 兩平台 job / run URL、觸發及來源、實際結果、適用 SPEC / 場景、可讀證據與缺口 |
| 授權 / 設定 | 當次允許操作與 envelope、保護 / rules / auto-merge 讀回、App 權限與 Environment 非秘密設定 |
| 交付 / 還原 | merge commit / main reachability、post-merge、證據保存位置與雜湊、還原驗證、worktree 狀態與清理結果 |
| 停止條件 | 身份 / SHA 漂移、證據不足、HIGH / CRITICAL、工具限制、重試餘額及恢復條件 |

不得記錄私鑰、token 或完整秘密 contexts；證據本身是未信任資料，hash 只能證明內容一致，不能證明驗收成立。

## 7. 常態啟用與完成判定

- [ ] 必要階段及 V01-V15 均有真實結果；必要失敗 / 缺失已處理，未以文件勾選或 reviewer 共識替代。
- [ ] 試行候選的同版本獨立審查、CI、產品驗收及人類 approval 成立；合併前再查最新 tuple、reviews、threads、保護與授權。
- [ ] 遠端合併與 main 可達性、主工作區 fast-forward、post-merge、證據及還原備份保全均有讀回。
- [ ] 清理只針對已合併且已核對的任務 worktree；staged / unstaged / untracked / ignored 均盤點，新變動保留，不用 force。
- [ ] 停用 / 事件處理與殘餘風險由維護者接受；owner 仍有管理設定能力，AI review 仍非第二位人類。
- [ ] 只有在正式核准與以上條件成立後，另記錄制度啟用版本 / 日期及作用域；本設計文件不得自行改成已導入。

本輪本地文件準備的驗證與審查，和未來 App 導入 / GitHub 合併 / 產品完成分開記錄。文件未合併前保留本地 worktree；下一步超出本地文件授權時停止並回報具體缺少條件。
