# U1 新證據與能力方案紀錄

沿用MUSOU_STEP_RECORD.template A–E；U1是E12前置單元，不重新定義E步或重設兩輪預算。

## A. 開始前範圍審查

```text
stepId: E12/U1
status: IN_PROGRESS_BLOCKED_UTC_MAPPING
implementationPr: null
implementer: Codex root
independentReviewer: native architecture_reviewer /root/unity_spec_review (advisory)
sourceBaseSha: 805db86f67ab2be152dea8abe57ca47f4e735fb7
previousStepPrAndDoneEvidence: E11 PR43 merged; formal APPROVED missing
reviewedPlanSha: 6c5282bf752e71dd54e69de14819f32b74d0dd5c
changedVariableIds: [V10, V12 measurement planning only]
requiredScenarioIdsAndSubcases: [S05 capability protocol; S01/S02/S03/S06/S07 preserved, runtime NOT_RUN]
allowedPaths: [docs/engineering/UNITY_E12_CAPABILITY_PLAN.md, docs/engineering/UNITY_E12_CAPABILITY_STEP_RECORD.md, openspec/changes/unity-migration-followup/tasks.md, release/unity-followup-u1 local-only evidence]
forbiddenChanges: [runtime, assets, .codex, thresholds, ACL/timezone/provider, remote mutation, sending art packet, paid generation]
preImplementationReview: advisory accept U1 evidence/plan, not runtime
preImplementationReviewEvidence: native reviewer response 2026-10-08; max3 total CIM samples
mergeAuthorization: null
paidActionAuthorization: null
```

## B. 候選版本與環境

```text
candidateSha: external checkpoint Git HEAD
currentBaseShaAtFinalReview: 805db86f67ab2be152dea8abe57ca47f4e735fb7
profileHash: unchanged; actual runtime NOT_RUN
assetManifestAndHashes: unchanged; art integration NOT_RUN
runnerVersionOrHash: E12 tests from candidate3f45d134; no runner edit
platform: Windows PowerShell sandbox diagnostic, not Player execution
osAndDriver: NOT_RUN this unit
engineOrBrowserVersion: source Unity6000.6.4f1; engine NOT_RUN
cpuGpuRam: NOT_RUN this unit
viewportAndUiScale: NOT_RUN
renderResolutionAndScale: NOT_RUN
vsyncRefreshRateAndFrameCap: NOT_RUN
seedsAndDifficulty: historical probe7/normal; no new gameplay
inputMethod: read-only files/official docs/CIM
startEndTimeWithTimezone: CIM2026-10-08T08:06:02.7075342Z..08:06:02.9130239Z (Taipei16:06:02)
```

## C. 驗證矩陣

| 檢查 | 完整命令／來源 | 結果與限制 |
|---|---|---|
| 最新base | git fetch origin main; rev-parse origin/main; E11 ancestry | PASS；805db86，未remote mutation |
| raw保全 | 11files逐份Get-FileHash SHA256與bytes重讀 | PASS；local-only index位置/hash見PLAN |
| source原因定位 | Counter名稱first-match；raw probe counter metadata | VERIFIED UI Toolkit誤選；未修runtime |
| 既有工具正負邊界 | node --test .worktrees/e12-performance/scripts/tests/e12-performance.node.mjs（repo root） | PASS15、FAIL0、SKIP0；source3f45d134，非新能力PASS |
| fresh clock diagnostic | Get-CimInstance GPUProcessMemory，最多3筆、只取timestamp/frequency/query UTC | ENVIRONMENT_FAILURE；3筆均「拒絕存取」，無新clock數值，額度用完 |
| OpenSpec/Git文件 | validate unity-migration-followup --strict; diff --check | 本地命令結果於交付核對 |
| 真實render／自然操作／感官／裝置／正式benchmark | 沒有執行 | NOT_RUN；本單元不能支持runtime改善 |

## D. Commit與審查閉環

```text
selfReview: scope/evidence checks
formalIndependentReview: NOT_RUN
formalReviewCommitSha: null
formalReviewUrlOrId: null
latestCiHeadShaAndResults: NOT_RUN (not pushed)
unresolvedReviewThreads: null
unresolvedBlockingFindings: host clock values available but reliable UTC mapping unproven; method/scope approval incomplete
reviewerOpenedArtifacts: final candidate advisory review pending
baseDriftAssessment: latest origin805db86 same source base
finalSameVersionVerdict: NOT_VERIFIED
```

## E. 完成與下一步門檻

```text
stepVerdict: BLOCKED, not VERIFIED/DONE
remainingFailuresOrEvidenceGaps: reliable clock UTC mapping; approved instrumentation/error method; formal gate
mergeAuthorizedByAndEvidence: null
mergeSha: null
postMergeValidationAndCompatibility: NOT_RUN
postMergeEvidence: null
rollbackCommitOrArtifact: spec checkpoint6c5282b; ordinary revert U1 docs if needed
nextStepAllowed: false (runtime capability unit2)
releaseOrPaidActionPerformed: false
```

無背景Player或美術製作。獨立advisory審查不能填成正式APPROVED；同候選最終回覆另記exact SHA，避免文件自引用commit迴圈。

## 追加host診斷與狀態轉移

使用者同意最多3筆host唯讀採樣；全部執行成功，沒有第4筆。原sandbox的拒絕存取仍保留，不重新計數或刪除。時間2026-10-08T08:13:05.1750759Z..08:13:07.9162601Z（Taipei16:13），raw與analysis hash見PLAN追加節。

- VERIFIED：host能讀取所需GPU／PerfOS時鐘欄位；兩者FromFileTimeUtc皆約比query UTC超前8h、彼此相差14–56ms（毫秒解析）。
- VERIFIED：第一筆combined query2673ms超過原2000ms上限；不放寬門檻、不標freshness PASS。
- UNKNOWN：可靠UTC mapping／底層原因。原GPU-only假設不足；不改provider、固定減8h或以query UTC冒充provider時間。
- NOT_RUN：指定Player PID/processStart/adapter／VRAM bytes身分與freshness、新runtime／visible／timing、正式benchmark。

本次授權diagnostic已完成；U1仍BLOCKED且1.2–1.4不勾完成。下一步先審查獨立UTC FILETIME／native performance對照的方法與範圍；不自動新增採樣或越過merge gate。

## 追加離線方法單元

- 當次授權：「let's go next」；開始前native architecture reviewer `/root/unity_spec_review` advisory accept。允許新增 `scripts/diagnostics/Test-E12ClockHypotheses.ps1`、local-only測試結果與本兩份docs追加；禁止新的CIM／PDH、host timezone讀取、runtime/provider/threshold修改。
- 首輪18 PASS／6 FAIL，TEST_FAILURE，失敗JSON保留。定位為離線JSON解析自動DateTime後隱式字串丟Z/fraction；correct1改DateKind String和explicitZ並加回歸，26 PASS／0 FAIL。被測script及兩次結果SHA見PLAN，未反覆重跑既有E12測試。
- VERIFIED：離線fixtures與指定fixturezone重播結果；首筆query超限兩種解讀均拒絕。UNCERTAINTY：實際WMI時鐘mapping未證明，原生跨來源對照未執行。
- 原E12兩輪與host3筆額度保持已用完；沒有新provider sample、Player或美術工作。task1.1保持完成，其餘未勾。U1不標VERIFIED／DONE，不進runtime第2單元。
