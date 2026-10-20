# 獨立 Astra 審查＋維護者核准：治理修訂提案

狀態：**PROPOSAL_ONLY / NOT_EFFECTIVE / NOT_IMPLEMENTED**。

## 1. 目的、來源與本輪授權

使用者要求未來不必強求 GitHub 非作者 approval，並選擇「保留獨立 Astra 審查、測試及本人明確核准，先準備治理修訂」。本提案調整核准的記錄形式，不取消實質獨立審查、必要人類驗收、安全或品質條件。

來源基準：`ae2b2b49cd0154e9278c01e6db78ed15967f2edd`。適用提議：`monkey1sai/changshan-longdan` 的未來、明確列入導入範圍的任務。不是所有 repo／任務的永久授權。

本輪僅新增本文件、[導入檢查表](INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_ADOPTION.md)、[提案逐步紀錄](INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_STEP_RECORD.md)。不修改現行 AGENTS／SPEC／workflow／GitHub 規則，不建立 App、替換作者或帳號、不發 GitHub review、不推送／開 PR／merge、不開始 G01。

現有 [SOLO_REVIEW_DESIGN](SOLO_REVIEW_DESIGN.md) 與其 checklist 保持原樣；它們仍是未生效的另一設計，不是本提案已導入的證據。

## 2. 三種相互獨立的判斷

| 判斷 | 提議中的責任方 | 必要資料與結果 | 不能代替 |
|---|---|---|---|
| 獨立審查 | 未參與候選實作的 Astra reviewer | 親讀 exact-head diff、source、適用 tests／raw evidence，出具可定位結果及 blockers | 測試、人類感官／專項簽核、owner acceptance、GitHub APPROVED |
| 維護者核准 | 人類維護者本人 | 對精確 SHA／範圍／可讀證據／限制明確表示接受，留下原始可稽核紀錄 | 第二位獨立人類、必要專家簽核、merge 授權或 GitHub review |
| 合併操作授權 | 維護者對當次操作 | 指定 repo／PR／base/head／允許操作／停止條件；合併前重讀 gate | 任何品質判定、後續任務永久權限、發布／安裝／付費授權 |

同一則 owner 原文可以清楚包含核准與操作授權，但必須分別能辨識，不能從「繼續」「可以」或舊任務同意推導未具體授權的操作。核准可由 repo 可稽核的明確人類原文提供；若來自本機對話，公開僅傳送經授權的去敏摘錄及版本綁定，不公開私人完整對話。原文及來源需供審查者確認，不能只由實作者自行聲稱「owner approved」。無法驗證來源或無傳輸授權時保持 HELD。

## 3. 獨立審查的最低契約

- Reviewer 與實作者分離；不同模型名稱本身不能證明獨立。記錄 session/run、實際角色、實作參與、requestedModel 與可觀測 runtimeModelEvidence。Backend 不可自證時如實標示，不捏造模型身分；模型或審查能力不符必要要求即 HELD，不擅自換 provider。
- Reviewer 親讀完整變更、相關原始 source、規格、測試與可存取 raw evidence，不僅讀摘要／模型分數。提供者產生的 hash/test log 與 reviewer 親自重跑結果分列。
- Reviewer 只讀，不代修；若 reviewer 已寫入修正，由另一位未參與該修正的 reviewer 重新審查。主控修正後是新 candidate，重新綁定獨立 review 和 owner acceptance。
- 完整 head/profile/asset/build 身分必須一致；base 漂移要有影響評估與必要重驗，不只確認 feature head 沒變。兩輪失敗修正上限及已用預算保留，不能用新 branch／新假說／新工具重開。
- 結果用 `INDEPENDENT_REVIEW_ACCEPTED`、`CHANGES_REQUESTED`、`HELD`，附 findings／證據／限制。既有 `APPROVAL_READY_ADVISORY` 不自動改名為新的接受；導入後須核對其範圍與當期正式契約，必要時重審。

## 4. 擬採用的證據欄位

```text
policyStatus: PROPOSAL_ONLY | ADOPTED_AND_EFFECTIVE
policyVersionAndEffectiveScope: null
repo / pr / baseSha / headSha: null
implementerIdentityAndSession: null
reviewerIdentityAndRun: null
requestedModel: null
runtimeModelEvidenceOrLimitation: null
reviewerImplementationParticipation: false | true | unknown
reviewedArtifactsAndHashes: []
independentReviewVerdict: INDEPENDENT_REVIEW_ACCEPTED | CHANGES_REQUESTED | HELD
reviewedHeadSha: null
requiredValidationResultsAndVersions: []
requiredHumanOrSpecialistSignoffs: []
ownerAcceptanceSourceAndIdentity: null
ownerAcceptanceExactQuoteOrAuthorizedExcerpt: null
ownerAcceptanceHeadShaAndScope: null
ownerAcceptanceLimitationsAndPermittedExceptions: []
mergeAuthorizationSourceAndExactTuple: null
githubReviewStateAndActualReviewId: actual platform state only
unresolvedFindingsAndThreads: []
retryBudgetAndConsumedRounds: null
mergeSha / postMergeEvidence / cleanupEvidence: null
```

`githubReviewStateAndActualReviewId` 始終如實：GitHub 沒有 review 就是無 review，不填 APPROVED。`ownerAcceptanceLimitationsAndPermittedExceptions` 僅揭露限制與有權核准的範圍，**不是豁免權**；安全、來源保全、必要獨立人類／專項簽核、數值門檻與產品驗收不能靠填 exceptions 跳過。

## 5. 提議生效後的交付判定

只對已正式導入版本／作用域：適用測試、真實證據、非實作者獨立審查、owner 明確核准、所有其他必要人類／專項 gates 都成立，才提議可標 VERIFIED；再有當次合併授權、實際遠端 merge、post-merge 相容性、證據保全及 worktree 清理才 DONE。

不再額外把「GitHub 非作者 APPROVED 事件」當作此替代作用域的唯一正式核准載體；GitHub 上實際存在的 required reviews／CODEOWNER／rulesets 仍必須遵守。若伺服器要求該事件，保持 HELD；本提案不授權 admin bypass、取消設定或以新帳號／App 補票。所有未列入替代範圍的較嚴必要人類獨立核准仍適用。

保留 S01–S08、所有數值、同版本驗收、可見回退與 tip/tipBase；CI／headless／截圖／Jev Choice 不代替自然遊玩或視聽／裝置確認。高風險、HIGH/CRITICAL findings、缺工具／來源／證據均阻擋；降低輸出包品質或縮減敵數不能用來通過門檻。

## 6. 首次導入與現行條款對照

本提案**不能批准自己的介紹、合併或生效**。當前規則繼續有效；首次導入候選須按當時有效規則完成必要核准。若缺該核准，activation=HELD；使用者選方向、Astra advisory、草案已 commit／merge 都不能自動解除。

| 現行入口／條款 | 未來需明確修訂／對照之處（本輪不改） |
|---|---|
| [AGENTS](../../AGENTS.md) Task Scope／Executable Step Plan | 獨立 review 不刪；正式批准的載體／owner identity／生效範圍需明定 |
| [共通 execution plan](../engineering/MUSOU_EXECUTION_PLAN.md) §1與狀態規則 | GitHub formal APPROVED 與新獨立 verdict＋owner acceptance 的關係；不可留衝突命令式條款 |
| [STEP_RECORD模板](../engineering/MUSOU_STEP_RECORD.template.md) D/E | 分列 review／owner acceptance／GitHub 真實狀態／merge authority，不偽填舊欄位 |
| [Godot SPEC](../../openspec/changes/godot-threejs-migration/specs/godot-threejs-port/spec.md) phase gates | 只修核准載體，保留獨立性、數值、同版證據與其餘 gates |
| [Godot tasks](../../openspec/changes/godot-threejs-migration/tasks.md) 1.3/每期審查項 | 以明確導入版本為界，不倒填舊 task；ADR/G00紀錄/plan的現況標示另對齊 |
| [單人 App 設計](SOLO_REVIEW_DESIGN.md) | 保留 NOT_EFFECTIVE 的歷史方案；若未來不採用，以另案有效決策說明，不部署 App 或暗改原文 |

導入需另案獨立 scope／精確 candidate 審查、人類批准及外部操作授權；列出政策版本、有效日期、適用 PR／base/head、原條款替代清單與未替代 gates；實際遠端 merge、post-merge 規則一致性檢查及安全清理齊備後，才可記 ADOPTED_AND_EFFECTIVE。原政策 bootstrap 要求若無法成立，應直接告知最小缺項，不以修改更低優先序文件覆寫當前不可豁免的指令。

這改的是未來流程載體；不宣稱歷史不合規變成合規，也不自動給當前治理提案或已合併 G00 任何豁免。新制度不能免除首次導入的舊規核准；此限制可能仍需一位合資格外部 reviewer，該殘餘阻礙本案如實保留。

## 7. PR #51／Godot 過渡

PR51 head `186503b0327f71583776204e8df0b6bd9d22fa52`、merge `ae2b2b49cd0154e9278c01e6db78ed15967f2edd`；Astra advisory、CI與merge是不同證據，不能回填 GitHub APPROVED。已下載模板與 MCP smoke 不是 G01 runtime／export 完成。

若未來制度合法生效，#51 是否納入新制度必須另作明確過渡裁決：核對原 candidate／merge tree、實際審查／owner acceptance、post-merge 與cleanup證據，保留先合併後核准的時間序列與缺口。沒有過渡裁決前維持既有 G00 HELD、Godot2/20，不能先跑G01再補規則。

## 8. 風險與停止條件

獨立 AI 並非第二位獨立人類，owner 也可能受摘要／時間壓力影響。以完整可讀證據、原文驗證、角色分離、精確版本、失敗保留及必要專項簽核降低風險，不能保證零缺陷。證據不可存取、身份／SHA不明、owner只同意方向、缺merge授權、現行規則／保護衝突、bootstrap未成立或超修正上限時一律HELD。停用亦需授權及受審變更，不能自動回到更寬鬆流程。
