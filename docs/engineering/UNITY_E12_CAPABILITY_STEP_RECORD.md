# U1 新證據與能力方案紀錄

沿用MUSOU_STEP_RECORD.template A–E；U1是E12前置單元，不重新定義E步或重設兩輪預算。

## A. 開始前範圍審查

```text
stepId: E12/U1
status: IN_PROGRESS_PENDING_CAPABILITY_METHOD_SCOPE
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
unresolvedBlockingFindings: observed-source local FILETIME evidence available; full capability method/scope approval incomplete
reviewerOpenedArtifacts: final candidate advisory review pending
baseDriftAssessment: latest origin805db86 same source base
finalSameVersionVerdict: NOT_VERIFIED
```

## E. 完成與下一步門檻

```text
stepVerdict: BLOCKED, not VERIFIED/DONE
remainingFailuresOrEvidenceGaps: specified Player freshness NOT_RUN; approved instrumentation/error method; formal gate
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

## 追加原生跨來源診斷

- 使用者同意最多3窗口；scope及精確script hash經native architecture reviewer run前readback接受。允許Capture-E12ClockComparison.ps1、local-only輸出及文件；未改runtime/provider/threshold，未remote mutation。
- 3窗口全同instance、API/CStatus/countertype正常，原生UTC前後包住來源查詢；WMI和PDH local解讀6/6符合既有lag/future數值允收窗口，UTC解讀6/6 FUTURE。部分PDH sample早於call start，不宣稱同步瞬時取樣。本機觀察來源的local FILETIME映射有一致證據，普遍WMI契約UNPROVEN，指定Player freshness NOT_RUN。
- syntax／C# compile／x64 ABI檢查PASS；raw／analysis的SHA及完整查詢時間見PLAN。只執行一次，無第4窗口；原失敗與額度不重設。
- 獨立reviewer親讀raw／analysis後確認task1.2可完成定位證據與raw保全，不解除task1.3完整方法、task1.4正式review/merge/postmerge gate。U1尚未VERIFIED／DONE；沒有背景Player或美術製作。

## Task1.3方法與新範圍提案

- 本次使用者授權「按照建議做」：整理方法及獨立範圍審查；僅本PLAN、STEP_RECORD及tasks三份文件。開始前reviewer `/root/unity_spec_review` advisory accept該文件scope，2026-10-08。基準`1cd50908ca7fc26b4311b8b69cc69ae3049e4f97`；未取得unit2 runtime、採樣、remote mutation批准。
- PLAN的M1–M7定義來源ledger、指定camera full-resolution ID/depth、指定HWND前景及事件、timing identity/去重/有界drain、1Hz精確記憶體與成本三模式。所有fixture及實際Player能力NOT_RUN；alpha/MSAA/clock/frame mapping或active wait語義未知維持BLOCKED。
- 必要runtime缺口：官方6000.6 counter reference已有active及排wait契約；實際同幀identity/單位/trace尚未驗證，不能用總時段假充active或重複扣wait。方案補齊官方來源，原gate不變，尚未修改CPU量測。
- 草案審查1個MEDIUM缺口已修：B/T/F共有最小1Hz memory observer，memory成本high-water有同口徑T對照；固定observer成本算入全部模式。另明列既有透明VFX是opaque方法的已知限制；完整visible/12次成本probe尚BLOCKED，須另透明coverage方法scope，不能關掉效果或稱本scope可解除全部能力。
- 新unit2 allowlist、最多3次短probe及12次成本probe、待批准成本界線已整理成具體提案；未執行/消耗新額度，也不重新計數原E12兩輪或三組診斷額度。全部remote、正式benchmark、資產製作仍排除。
- task1.3保持未勾：待exact-candidate獨立方案審查及人類新scope批准。task1.4正式APPROVED／merge授權／postmerge保持NOT_RUN，runtime第2單元不可開始。當前總進度2/22。
- 此次格式/diff/路徑檢查與最終advisory結果以交付exact SHA記錄；不能把文件檢查標成量測能力PASS。無背景採樣/Player/美術工作。

### 透明coverage方法準備

- 方法checkpoint `68d1522c…`獨立advisory accept後，沿用同文件授權補M2-T具體算法，核對實際shader/FeedbackView hashes和blend properties。提出camera scene pixel contribution語義，與人眼辨識/後處理最終顏色分開；語義未獨立接受就visible=null，不暗改驗收。
- 重用鎖定Feedback alpha/depth/geometry：opaque fragment進ID遮擋；additive保留destination，dust alpha1才完全覆蓋，unsupported來源BLOCKED。追加1個measurement coverage shader與精確fixtures、8組雙target buffer提案，額度與原gate不增加。
- 透明方法所有GPU parity/成本/Player測試NOT_RUN；待獨立方案審查、實作scope批准及task1.4正式gate。task1.3仍未完成，沒有新採樣或runtime修改。
- M2-T draft審查確認source/blend吻合，要求明列分析性權重不保證framebuffer有限精度/量化/飽和後實際色彩影響；已補齊此限制及人類scope語義批准，parity不能替代語義決策。

## PR送審準備與最新base

- 使用者明確「同意授權」推送`codex/spec-unity-migration-followup`至`origin`並建立SPEC/U1審查PR；目的地`monkey1sai/changshan-longdan`、base `main`。僅送審，不授權merge、unit2 runtime、採樣或部署。
- 本次fetch確認`origin/main=9ab737ad0324f6922e116845490dada6d7c55c67`；相對805db86只新增MIT `LICENSE`，與本分支12個新增檔不重疊。保留原805db86來源盤點，不倒填歷史驗證；PR採最新main作base，不移除license或更新遊戲。
- 修正README的舊「tasks均未執行」描述，使其與2/22台帳一致。必要全分支exact-head advisory及CI結果另於PR交付核對；正式APPROVED仍待取得。
- Authorization Envelope：Destination=GitHub origin monkey1sai/changshan-longdan、指定feature branch/main PR；Purpose=SPEC/U1送審；Allowed=non-force push該branch、create PR、readback/checks；Data=12個tracked SPEC/紀錄/diagnostic檔及繁中PR本文；Forbidden=raw local-only產物/credentials、force/delete、merge/auto-merge、runtime/deploy/provider；Stop=base/head漂移、既有branch/PR衝突、必要review blocker、auth/network失敗。PR建立前後核對branch SHA；未批准gate保持不變。
