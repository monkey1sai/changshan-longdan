# E11 逐步實作、驗證與審查紀錄

依 `MUSOU_STEP_RECORD.template.md` A–E 欄位整理。這是本機候選準備紀錄，尚未建立 PR。最終 immutable candidate SHA、原始 run ID／hash 及當輪結果保存於候選 commit 外的本機 evidence，避免自我引用；外部 reviewer 可存取 artifact 尚未建立。

## A. 開始前範圍審查

```text
stepId: E11
status: AWAITING_REVIEW
implementationPr: null
implementer: Codex root; native workers e11_banners, e11_route
independentReviewer: native architecture_reviewer /root/e11_scope_review
sourceBaseSha: 30bdbac8a549a3b6b27f062f1343f77c5021a7bf
previousStepPrAndDoneEvidence: PR #41 merge d554e253ad3be00a8a6fb27471d433baf40b52b9; E10_ASSETS.md
reviewedPlanSha: 30bdbac8a549a3b6b27f062f1343f77c5021a7bf
changedVariableIds: [V06, V07, V11, V12]
requiredScenarioIdsAndSubcases: [S05 encounter content, S08 phases/death/retry/locale]
allowedPaths: [Unity Combat/Character runtime and Foundation tests, scripts, tests, TestData fixture, E11 docs, test script registration]
forbiddenChanges: [src runtime, asset/layout/balance/AI changes, paid generation, E12, external writes]
preImplementationReview: advisory accept; no blocking scope issue
preImplementationReviewEvidence: native agent final response for /root/e11_scope_review, 2026-10-07
mergeAuthorization: null
paidActionAuthorization: null
```

沿用 runner 與範圍細節見 `E11_DIRECTOR.md`。advisory 並非 formal independent APPROVED。審查要求初始化兩次 reset、retry 繼續 RNG、operational idle 定義、保守通路下界及 DEV／自然證據分開，全部納入實作與量測契約。

## B. 候選版本與環境

```text
candidateSha: null (record outside candidate commit)
currentBaseShaAtFinalReview: null
profileHash: null (calculate into local evidence)
assetManifestAndHashes: null (calculate into local evidence; assets unchanged)
runnerVersionOrHash: null (calculate into local evidence)
platform: Windows; Unity Mono StandaloneWindows64; retained Web
engineOrBrowserVersion: Unity 6000.6.4f1 / revision 12bfff696524; Node v22.22.0
osAndDriver: null
cpuGpuRam: null (E11 is not E12 performance acceptance)
viewportAndUiScale: planned 1280x720 route; actual readback required
renderResolutionAndScale: actual readback required
vsyncRefreshRateAndFrameCap: actual readback required; route fixed-step 30 Hz is not measured FPS
seedsAndDifficulty: seed 7; normal route; DEV threshold/flow tests use declared setups
inputMethod: scripted WASD; DEV presentation and lethal setup separately marked; natural play NOT_RUN
startEndTimeWithTimezone: actual command/route evidence
```

## C. 驗證矩陣

| 檢查 | 對應 V/S | 命令／路線 | 被測版本與結果 | 原始產物 | 審查者確認 |
|---|---|---|---|---|---|
| 修改前 Web 基線 | V12 | Vitest exclude release、typecheck、parity:check、test:unity-runner | 30bdbac8；296／七份／65 PASS | release/e11/baseline-20261007 local_only | NOT_RUN |
| 正例／負例／邊界 | V06/V07/V11 | layout、director diagnostics、events、locale／flow tests | final candidate NOT_RUN | final local evidence | NOT_RUN |
| Unity 五階段 | S05/S08 子情境 | fresh clone；unity:validate | NOT_RUN | final local evidence | NOT_RUN |
| Web 回歸與打包 | V12 | Vitest、typecheck、build、parity、runner、package:itch | candidate-a content：308／8 fixtures／84，全部 exit 0；commit 內容一致性另留 evidence | release/e11/candidate-a local_only | NOT_RUN |
| 真實渲染／連續影片 | V07/V11 | e11 fixed route＋DEV banner probes | NOT_RUN | final local evidence | NOT_RUN |
| 自然遊玩 | S08 | 使用者試玩同候選 Player | NOT_RUN | null | NOT_RUN |
| 人類聽感／實體手把 | S08 | 沒有新音效／映射；不作感官 PASS | NOT_RUN | null | NOT_RUN |
| 效能／soak | S05 | E12 尚未開始；E11 不提出效能驗收主張 | NOT_RUN | null | NOT_RUN |
| 未適用項目的理由與批准 | — | 不以缺證豁免已承諾功能 | NOT_RUN | null | NOT_RUN |

固定 seed 的 replay、DEV 注入、自然輸入分開。通路測試只證碰撞幾何可達；9 秒路線不等於長時間無軟鎖、自然通關或 E12 效能。原始失敗與後續補測均保留。

## D. Commit 與審查閉環

```text
selfReview: IN_PROGRESS
selfReviewScopeAndEvidence: full local E11 diff and deterministic regression
formalIndependentReview: NOT_RUN
formalReviewCommitSha: null
formalReviewUrlOrId: null
latestCiHeadShaAndResults: null (no push authorized)
unresolvedReviewThreads: null (no PR)
unresolvedBlockingFindings: null
reviewerOpenedArtifacts: NOT_RUN
baseDriftAssessment: NOT_RUN
finalSameVersionVerdict: NOT_RUN
```

最終 advisory 另列 exact candidate 與 reviewer 打開的產物，不能填成 GitHub 正式 APPROVED。每個 correction round 與 log 保留；同問題兩輪未過則 BLOCKED，不擴重試預算。

## E. 完成與下一步門檻

```text
stepVerdict: AWAITING_REVIEW
remainingFailuresOrEvidenceGaps: [final candidate validation, rendered route, final advisory, natural play, formal APPROVED, accessible remote artifacts, CI, authorized push/PR/merge, post-merge checks]
mergeAuthorizedByAndEvidence: null
mergeSha: null
postMergeValidationAndCompatibility: NOT_RUN
postMergeEvidence: null
rollbackCommitOrArtifact: ordinary scoped revert to E10 base
nextStepAllowed: false
releaseOrPaidActionPerformed: false
```

當本機工作完成時，將本文件與外部候選 evidence 一併複製到 PR 描述／評論；目前 PR mutation 未獲授權。正式 VERIFIED／DONE 門檻沿用原計畫，不因本機測試或 advisory 自動成立。
