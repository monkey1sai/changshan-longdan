# E12 逐步實作、驗證與審查紀錄

依 `MUSOU_STEP_RECORD.template.md` A–E；本文件記錄實作狀態，immutable candidate／raw run／hash 另存於本地證據，避免自我引用。

## A. 開始前範圍審查

```text
stepId: E12
status: IMPLEMENTING_CAPABILITY_PROBE
implementationPr: null
implementer: Codex root
independentReviewer: native architecture_reviewer /root/e11_scope_review (advisory)
sourceBaseSha: be04336f108db76bb75da31e8b68e065eb182307
previousStepPrAndDoneEvidence: E11 PR #43 merged; formal APPROVED missing; post-merge engine/Web compatibility PASS; user explicitly requested E12
reviewedPlanSha: be04336f108db76bb75da31e8b68e065eb182307
changedVariableIds: [V06 measurement only, V10, V12; V09 existing assets unchanged]
requiredScenarioIdsAndSubcases: [S05 populations/peaks/soak, S01/S02/S03/S06/S07 regression]
allowedPaths: [Character measurement/seed seam, Foundation timing flag/tests, scripts, package scripts, E12 docs]
forbiddenChanges: [combat balance/AI/quality/asset tuning, new packages, E13, external writes, deployment/spend]
preImplementationReview: advisory accept capability tooling; formal workload needs-follow-up
preImplementationReviewEvidence: native review responses 2026-10-07; E12_PERFORMANCE.md
mergeAuthorization: null (E11 authorization is not new E12 authority)
paidActionAuthorization: null
```

## B. 候選版本與環境

```text
candidateSha: null (immutable manifest outside commit)
currentBaseShaAtFinalReview: null
profileHash: 8490a542024c444299464af748573c8820cbc8d16a2d6adee5308743b5403577
assetManifestAndHashes: unchanged; local manifest required
runnerVersionOrHash: local manifest required
platform: Windows; Unity Mono StandaloneWindows64; retained Web
osAndDriver: Windows 11 Pro; NVIDIA 32.0.15.8097
engineOrBrowserVersion: Unity 6000.6.4f1 / 12bfff696524; Node22.22.0
cpuGpuRam: i5-13500 / RTX4060Ti / 63.75GiB
viewportAndUiScale: planned 1920x1080; Player readback required
renderResolutionAndScale: planned 1920x1080 / 1
vsyncRefreshRateAndFrameCap: planned 1 / 60Hz / 60; Player readback required
seedsAndDifficulty: probe 7/normal; formal 7/11/23 NOT_RUN
inputMethod: probe normal Update; no DEV health/KO/teleport injection
startEndTimeWithTimezone: local raw commands
```

## C. 驗證矩陣

| 檢查 | 被測版本 | 結果 | 產物／限制 |
|---|---|---|---|
| E11 合併後 Unity | be04336f | PASS | run e180ca75-2ffb-498a-86ce-8b68f19cf275；local_only |
| E11 合併後 Web／parity／runner／build | be04336f | PASS | 308／8 fixtures／84；非 E12 成績 |
| E12 分位數／單位／缺值／失焦／VRAM身分／CSV／輸出邊界／spawn failure／timestamp序列反例 | commit 外 manifest | PASS：15新測試＋84既有＝99 | synthetic unit data，不是效能結果；原始 log local_only |
| E12 Unity seed／subset tests | commit 外 manifest | NOT_RUN | 等完整 Unity validator |
| E12 短 Player 能力 probe | commit 外 manifest | NOT_RUN | 3+10 秒，不是正式 30+180 秒 |
| 20／50／100／200／300 三 seed／30分鐘 soak | null | NOT_RUN | 必要能力、workload、timing alignment 未齊備 |
| 真正可見數／自然遊玩／感官／裝置 | null | NOT_RUN | 不以 frustum／短 probe／CI 代替 |

## D. Commit 與審查閉環

| 輪次 | candidate | 當輪結果與審查 | 修正 |
|---|---|---|---|
| 初始工具候選 | 2ae7db3bdd9de82a6a46c2c16be6a9b2805eaa36 | Unity run dc7c6f45-2af4-427f-8484-d4b8b9ff5de7 五階段 PASS；Web308／parity8／Node92 PASS；advisory 4 MEDIUM | 保留 raw；未執行此版本 probe |
| correction round 1 | 089948315f9dc69fbb0dadc76bba5112c2d7aa74 | Unity run 0b500855-f098-4ede-b199-c5cbb6c4f152 五階段 PASS；Web308／parity8／Node97 PASS；review 1 MEDIUM 殘留；尚未 probe | resolved scope＋exclusive output ownership、controlled helper error、Player身分／raw provider timestamp、Castle Ready、全 build payload hashes |
| correction round 2 | commit 外 manifest | Node99 PASS；新 Unity／raw probe 尚待實跑 | GPU序列只更新已接受有效高水位；invalid／retreat不降基準；launcher UUID與Player report綁定 |

初始 output 污染負例已重現：拒絕既存目錄後仍新增 result.json，測試 8 PASS／1 FAIL；修正後 incomplete／complete evidence 均保持原內容。此失敗保留於工具輸出紀錄，不宣稱從未失敗。

```text
selfReview: source review in progress
formalIndependentReview: NOT_RUN
formalReviewCommitSha: null
formalReviewUrlOrId: null
latestCiHeadShaAndResults: null (no E12 push authorized)
unresolvedReviewThreads: null
unresolvedBlockingFindings: true-visible provider; formal workload; delayed timing alignment
reviewerOpenedArtifacts: NOT_RUN
baseDriftAssessment: initial merge tree identical
finalSameVersionVerdict: NOT_RUN
```

## E. 完成與下一步門檻

```text
stepVerdict: IN_PROGRESS; not VERIFIED/DONE
remainingFailuresOrEvidenceGaps: formal benchmark capabilities/workload, staged runs, soak, applicable regression, formal independent APPROVED, current CI
mergeAuthorizedByAndEvidence: null
mergeSha: null
postMergeValidationAndCompatibility: NOT_RUN (E12)
postMergeEvidence: null
rollbackCommitOrArtifact: E11 merge be04336f
nextStepAllowed: false (E13)
releaseOrPaidActionPerformed: false
```

停止／回滾與跑前 budget 見 `E12_PERFORMANCE.md`；失敗產物追加保存，不覆蓋、不刪除。
