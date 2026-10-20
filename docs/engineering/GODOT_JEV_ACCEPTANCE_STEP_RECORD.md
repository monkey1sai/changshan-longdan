# Godot新增Jev最高S自然破關驗收：逐步紀錄

本文件只記SPEC補充，不是遊戲／AI／政策啟用的通過證據。沿用[MUSOU step模板](MUSOU_STEP_RECORD.template.md)A–E。

## A. 開始前範圍審查

```text
stepId: GODOT_JEV_FINAL_ACCEPTANCE_SPEC
status: AWAITING_REVIEW
implementationPr: null
implementer: OpenAI API assistant / parent session
independentReviewer: independent read-only reviewer subagent, requested Astra
sourceBaseSha: b347ac57f1f009bf8543a1fde4409a3748e15254
previousStepPrAndDoneEvidence: Godot G00 still held; this is authorized SPEC preparation only
reviewedPlanSha: existing Godot SPEC/design reused; no runtime plan changed
changedVariableIds: [V11 acceptance semantics, V12 evidence/protocol; runtime unchanged]
requiredScenarioIdsAndSubcases: [S08 Jev-led victory/S; all S01-S08 preserved]
allowedPaths: [openspec/changes/godot-threejs-migration/specs/godot-threejs-port/spec.md, openspec/changes/godot-threejs-migration/tasks.md(task5.3 wording only), openspec/changes/godot-threejs-migration/design.md, docs/engineering/GODOT_MIGRATION_DESIGN.md, docs/engineering/GODOT_JEV_ACCEPTANCE_STEP_RECORD.md]
forbiddenChanges: [runtime/helper/tests source, assets, scoring, task checkbox/count, current approval gates, settings/credentials, provider/API/data transfer, paid calls, installs/downloads, push/PR/merge, G01]
preImplementationReview: ACCEPT_SCOPE documentation drafting only
preImplementationReviewEvidence: reviewer run5b373188-06ee-426d-82fc-b9ff0ee118c4 / external scope-review.md
mergeAuthorization: null
paidActionAuthorization: null
```

使用者新增「最終驗證需用jev ai打出破關最高分才算移植成功」，並先要求SPEC→獨立subagent審查→在前置成立後實作。查證`BattleResult`無獨立數值score，既有最高是S，`rank()`需win及seconds<300／damage<400；rank本身不檢查300KO，因此SPEC另列實際ko=300。Windows/Web各至少一場，選定難度與seed跑前批准；原四難度矩陣不減少，也不暗增為四難度各需S。

現有`JEV_VISION_PLAY.md`有舊Three.js Normal300KO/S作者紀錄與固定helper/model契約，僅供參考，不重用成Godot PASS；未改helper或呼叫provider。TypeSafe live docs查核：Jev是Choice決策、執行由程式負責、images experimental、confidence不證明結果（[images](https://docs.typesafe.ai/images)、[Choice](https://docs.typesafe.ai/primitives/choice)、[confidence](https://docs.typesafe.ai/confidence)）。

## B. 來源、候選與環境

```text
candidateSha: external exact-head manifest after scoped local commit
currentBaseShaAtFinalReview: pending readback
profileHash: unchanged
assetManifestAndHashes: unchanged
runnerVersionOrHash: external document validator / source-rank boundary check; no game runner edits
platform: Windows host; documentation preparation only
osAndDriver: NOT_RUN
engineOrBrowserVersion: NOT_RUN this task
cpuGpuRam: NOT_RUN
viewportAndUiScale: NOT_RUN
renderResolutionAndScale: NOT_RUN
vsyncRefreshRateAndFrameCap: NOT_RUN
seedsAndDifficulty: final Jev protocol PENDING; not retrospectively chosen
inputMethod: none sent to game/provider
startEndTimeWithTimezone: external validation UTC
```

Worktree`C:/Repos/changshan-longdan-godot-jev-spec`、branch`codex/godot-jev-acceptance-20261020`，base如上。主工作區觀察到未提交`AGENTS.md`刪除，本任務保留現況，不restore／stage／覆寫；本隔離worktree的AGENTS來自origin/main且不修改。Requested Astra與reviewer能否獨立觀測backend分列，不捏造身分。

## C. 實施次序與驗證矩陣

1. 重用現有SPEC/design；只在task5.3追加最高S gate，新增requirement與success／boundary／cheat／missing evidence／provider-budget負例，不更改20項結構與勾選。
2. 對齊allowed文件中「若沿用Jev」條件語句為強制最終gate；完整保留其他phase、核准路由、品質／效能／人工驗收。
3. 五檔allowlist／其他原檔byte identity、無變更source scoring/helper、source rank邊界、相對links／UTF8／secrets／diff check、OpenSpec strict及精確candidate blobs核對。
4. 本地scoped commit後給新鮮Astra獨立exact-head SPEC審查；不以scope acceptance當final，不發API／不寫移植runtime。

| 檢查 | 範圍與證據 | 結果 |
|---|---|---|
| base／隔離／scope | HEAD/status與run5b373188… | PASS開始來源一致，scope ACCEPT，非formal核准 |
| 五檔allowlist／現有source未變 | Git base blob comparison，含rank/helper/assets/current gates | 外部validation manifest |
| task與既有SPEC保全 | 20個ID／checkbox不變；除允許Jev條件句及新增requirement外原內容不變 | 外部validation manifest |
| S語義／正負邊界 | source rank函式讀回／小於邊界、等於300或400、敗北及KO非300案例 | 外部source-rank report；不是Godot實玩 |
| 完整條款／links／UTF8／secrets／whitespace | 文檔validator＋缺mandatory／壞link記憶體負例、git diff --check | 外部validation manifest；不是executor能力測試 |
| OpenSpec strict／候選一致性 | openspec validate godot-threejs-migration --strict及candidate blob hashes | 外部結果 |
| JevAPI／影像傳送／費用 | 本輪未授權、未呼叫，未取得key值 | NOT_RUN，actual calls0／本輪provider支出0 |
| Godot import/export／play／影片／最高S | 本輪僅SPEC，不啟動Godot或遊戲 | NOT_RUN，不借舊Web S |
| 新gate實際防作弊／雙平台executor／budget運作 | eligible階段依protocol與授權實作、驗證 | NOT_RUN，不能用文字case代替 |
| final exact-head SPEC review | reviewer須親讀完整diff/source/evidence，記身份限制 | PENDING |

raw evidence預定`C:/Repos/changshan-longdan-godot-evidence/godot-jev-acceptance-20261020/`，worktree外local_only；尚未授權公開。首輪`validation-1.json`為56 PASS／0 FAIL、exit0；`source-rank-1.json`另有7個來源rank／strict邊界案例通過，包含rank=S但KO=299仍拒絕新增驗收的獨立數值謂詞。這不是自然遊玩／Godot／Jev gate執行。紀錄更新後另驗新序號並與candidate blob hash核對。source-rank boundary與文件檢查只驗目前來源語義／SPEC覆蓋，不證明Godot評分或AI已贏。必要感官、裝置、效能及全S矩陣後續不豁免。

## D. Commit與審查閉環

```text
selfReview: source-rank semantics and acceptance coverage; validation detail external
formalIndependentReview: NOT_RUN under current effective policy
formalReviewCommitSha: null
formalReviewUrlOrId: null
independentFinalSpecAdvisory: PENDING
ownerAcceptanceExactCandidate: null
githubActualReviewStateIdAndCommit: null (no PR)
applicableApprovalRoute: LEGACY_FORMAL_GATE (policy activation still unverified/inactive)
applicableFormalApprovalSatisfied: false
latestCiHeadShaAndResults: NOT_RUN (not pushed)
unresolvedReviewThreads: null
unresolvedBlockingFindings: current phase/formal gates remain; future Godot Jev executor/protocol/budget not yet verified
reviewerOpenedArtifacts: scope sources only; final candidate pending
baseDriftAssessment: sourcebase same at start; final readback external
retryBudgetAndConsumedRounds: this SPEC corrections0; all historical execution budgets preserved
finalSameVersionVerdict: NOT_VERIFIED
```

## E. 完成與停止條件

```text
stepVerdict: SPEC_PREPARATION_ONLY
remainingFailuresOrEvidenceGaps: [exact-head final SPEC review, applicable formal approval, any future remote operation authorization; eligible Jev executor/protocol/data-cost-attempt permissions and actual outcomes]
mergeAuthorizedByAndEvidence: null
mergeSha: null
postMergeValidationAndCompatibility: NOT_RUN
postMergeEvidence: null
rollbackCommitOrArtifact: ordinary revert scoped SPEC changes, preserve sourcebase and all raw failures
nextStepAllowed: false (G01 runtime / policy activation / Jev provider execution)
releaseOrPaidActionPerformed: false
```

新增最終JeV gate不豁免任何前置。Godot目前2/20（10%task計數），不因規格完成勾5.3。不放寬S、不改300兵、不用DEV／改速改分或人工代打，不能用Choiceconfidence或舊Three.js成果判Godot成功。同一驗收任務跨Windows/Web／工具／目錄／resume不重設實際已用預算；新任務額度跑前明確核准。未合併worktree保留，不清主工作區刪除／其他成果、不reset／clean／force。
