# U1 新證據與能力方案紀錄

## 2026-10-10 registration 方法實作準備（尚未呼叫API）

- 使用者「同意」續行來源方法；獨立pre-implementation接受最多2次固定registration metadata calls，先英文名後providerGUID，互斥switch、固定v2第三step hash/GUID、local-null、4096/16byte、lang0、每來源2s/外20s、錯誤不resize/retry、逐步CreateNew。原metadata批次與三Player窗口不挪用；不呼叫CIM/registry/PDH或Player，source implementation/version/clock仍UNKNOWN。
- 重用既有診斷script與Node離線測試，只新增此明確mode及原生ABI/strict decoder；沒有native plugin或依賴。離線fixture直接抽取production C#並驗GUID16/uint32、exact英文名、嚴格UTF16/NUL/長度、非Empty GUID、錯誤required/undefined size及oversized success；用stub替代唯一native Read，執行production PS循環，驗成功2call、錯名/API8/notfound/2100ms超時各只1call並先保存再停止。stub不呼叫native/provider；原API本機存在性仍NOT_RUN。
- 測試期間發現fixture C# using位置錯誤，以及PowerShell nonterminating編譯錯誤可能被最後的PASS字串掩蓋，分類TEST_FAILURE。已將fixture封裝namespace、兩個離線harness明確ErrorActionPreference=Stop並要求stderr空；先前表面PASS不能作證據。修正後單一新fixture雙runtime1/1 PASS，尚待完整30項重跑及exact-SHA review。沒有實際registration採樣或新Unity runtime主張；SPEC仍4/22（18.2%）。
- 修正後完整E12Node30/30與OpenSpec strict PASS；追加互斥switch在入口拒絕的雙runtime負例後重跑新fixture，確認任何metadata/native呼叫前停止。仍等待精確候選獨立source review，沒有實際API呼叫。

## 最新交付：執行步驟與 A1-v2（2026-10-09）

- 使用者要求依任務清單轉為執行步驟並逐一實作／驗證；承接上一則已具體化一次v2修訂。PLAN開頭A1–D1共12步覆蓋18個未完成task，列前置、動作、驗證、停止條件與責任；原tasks維持4/22（18.2%），未以文件新增完成項。獨立review exact `2771abd64a7b1cec3286cd9852ce62e62edf5fd1` 全diff無阻擋，只接受一次A1metadata執行，不解除後續gate。
- A1-v2 run `e6656535-3a39-43ab-a093-31400787db8f`，source上述2771abd，script SHA256 `66227003856abd592c33f564a4bae0e023a4bbb07d6fb9a706eed38b7bc9e7eb`。fresh `release/e12/player-clock-v2`，只刪child env.PSModulePath，未改parent/user/machine；controller總20s，實際3084.5699ms／exit2／end `2026-10-09T07:19:43.398Z`，sourceUnchanged=true。
- raw按序OS140.522ms、GPU_DRIVERS172.1903ms、GPU_COUNTER_CLASS2021.6998ms。第三來源超過固定2000ms，保存第三份step與raw後即停。CIM3/4，第四CIM、registry、固定檔案群組均未開始；Player未啟動、PDH/GPU instance/counter windows0/3。v2一次已使用，不補第四CIM、不重跑／降門檻。v1完整保留。
- 環境修訂已實際解除Get-FileHash啟動問題；來源必要deadline仍FAIL/BLOCKED，並非遊戲PRODUCT_FAILURE。raw為BLOCKED_METADATA/METADATA_SOURCE_DEADLINE，identity/binding/environment最終欄位null、clockMapping=UNVERIFIED；純verdict為BLOCKED_CLOCK_MAPPING/metadataObserved=false/playerAllowed=false。未取得完整metadata，不能把晚回schema提升為來源或clock PASS。
- 獨立reviewer親讀command/controller/raw/三step/analysis，重算8檔bytes/hash全一致，step與raw逐項相符，純verdict一致。monotonic ticks獨立重算第三筆2021.6819ms仍超2000ms，不是浮點邊界誤差。source clean/script hash不變；接受此失敗證據與停止判讀，非正式APPROVED。
- 證據索引：`release/e12/player-clock-v2/analysis.json` SHA256 `d82f389343a40ca49a7b5935db417dc486e5dd58dc53dae6fb841b3601b17888`，包含全部8檔清單；metadata SHA256 `91f2d13bf0ff4a57ba3883b8887c830b35f023b69ac961ea44bc69186197050a`，第三step `474e781f8430d234e007ee69dacc5f7dedb67adad5d5508f46a1ddd116553a00`。raw為ignored本地檔，不外傳；tracked記錄保留定位/hash。
- 未進A2或後續正式驗證，沒有新Unity五階段／正式E12／完整自然遊玩PASS。本輪OpenSpec strict PASS；既有29/89離線測試沒有source變更故未重跑，不攜作本輪runtime證據。下一個方法準備只分析既有schema/官方資料；PLAN記GUID／RegistryKey／V2／資源binary與producer綁定尚未證明，不自行猜registry分支、追加本機查詢或產生v3。沒有背景Player/provider、美術製作、remote動作。

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

## 使用者最終驗收要求補充

- 新指示要求繼續依SPEC、每次完成回報完成度，最終打開Unity用Jev執行遊戲且通過所有必要測試。僅补design/spec/tasks及本紀錄；不改22項結構、runtime/.codex或原gate。
- 最新PR45核對：Draft/OPEN、head ee526ec、base9ab737a、formal reviews=0、未merge、auto-merge=null；Ubuntu/Windows CI success。當前仍2/22（9.1% task計數），下一eligible為1.3語義/範圍批准與1.4正式gate，不進unit2。
- 實際workspace jev_status：enabled0.9/10、workspace_override=true、advisory_only=true；沒有可呼叫Unity MCP executor。使用者於2026-10-08明確確認「Jev選擇，Unity工具執行」；Jev不是Unity直接執行器，缺實際執行能力不算完成。此次沒有provider Choice/recorded observation，無需虛構outcome。
- 既有 `node scripts/unity-preflight.mjs --mode inventory --out release/e02/final-unity-jev-pending` 只讀PE/專案/保留素材，ready=true、Editor=6000.6.4f1_12bfff696524、asset hashes一致；engineExecutionSupported=false、unityProcessStarted=false、compile/Edit/Play/build/Player/visibleScene/license均NOT_RUN。這是precheck，不是Unity啟動或正式最終preflight。
- 使用者最終要求已列為5.2/5.3的強制完成條件：可見Editor、同版輸出包、Jev/實際executor、所有必要測試及formal/merge/postmerge皆齊才22/22。沒有背景Unity/Player、provider採樣或美術製作；此補充文件不解除PR45與unit2gate。

## Task1.3方案退出（2026-10-08）

- 使用者明確「同意下一步，不要偏離spec」後，另明確選擇「接受M2-T工程量測定義，保留完整遊戲驗收」。此輪新範圍批准限已具體提出的unit2 allowlist、fixtures、最多3短probe及12成本probe與既定停止條件；未列檔案、追加採樣、降低門檻、merge/deploy仍不授權。只有task1.4全部gate齊備後才可使用此範圍，不在本輪執行。
- 獨立reviewer `/root/unity_spec_review` 親讀M1–M7/M2-T，核對原始索引11份bytes/SHA及方案9份local-only JSON hashes吻合；方法審查發現M6 B/T無pixel pass卻要求五數coverage的矛盾。僅修該契約：B/T visible=NOT_MEASURED，不借用F；共同來源逐simulation tick identity/事件/四數相容，F每run自取完整pixel結果，任一不符fail closed。
- 修正後独立方法advisory接受；不將此審查當formal GitHub APPROVED。逐tick相容在合法route能否達成仍NOT_RUN，失敗不得放寬或自增重試。確定性檢查：OpenSpec strict、diff check、四份本機JSON解析與原hash核對PASS；沒有新provider/Unity執行。提交後另核對exact candidate與其CI，舊head CI不移作新head結果。
- Task1.3只完成方案/範圍批准，非能力工程。整體3/22（13.6% task計數）；task1.4仍缺正式獨立APPROVED、獨立merge授權與postmerge，不進unit2。PR45核對基準head7e69e51、base9ab737a、Draft/OPEN、reviews=0、auto-merge=null、unresolved threads=0且pagination無下一頁；舊head CI Ubuntu/Windows PASS。classic main protection API回404 Branch not protected，不能推定其他rulesets或repo正式審查規則取消。
- 停止於formal gate；最終仍須可見打開Unity，Jev選擇/Unity工具執行、同版完整Player矩陣及使用者體驗確認皆通過才SPEC completed。沒有背景Unity、Player、provider採樣或美術製作。

## U1合併後退出（2026-10-08）

- 使用者當次明確「已經審判合併；依照spec逐步執行，全spec complete才可停下」。GitHub PR45為MERGED，mergedAt=2026-10-08T13:34:17Z（臺北21:34:17），merge SHA=e85840fad45b7704fab994945aee229f886c3b22、base main、已審head=32bf015ddf979694a41977a69881e997256056c4；fetch origin/main同SHA，merge ancestry PASS。
- 保留制度差異：GitHub reviews仍0，不登錄不存在的GitHub APPROVED。依當次使用者人類外部審查/合併決定，僅接受本U1文件單元退出；獨立reviewer /root/unity_spec_review確認此處理符合指引優先序。此人類決定不延伸為後續單元的審查例外，不降低Unity/runtime/full-game gate。
- Postmerge同版本e85840f驗證PASS：Web Vitest 35 files/308 tests、npm run build（包含typecheck）、Unity runner工具84 tests；OpenSpec apply/status可讀。既有完整12檔差異與診斷parser/hash已審，merge相對已審head僅main既有LICENSE；Unity runtime/asset未變。本U1不新增Unity實作，這些工具測試不是Editor/Player或視覺驗收。
- npm ci初次ENVIRONMENT_FAILURE：sandbox無法寫使用者npm-cache（EPERM）；改成本任務ignored release/unity-e12-capability/npm-cache、--ignore-scripts後PASS，不修改ACL/全域cache。安裝提示既有1 high vulnerability，未執行audit fix或擴改依賴。
- 工作區採新隔離branch codex/unity-e12-capability，自e85840f開始；保留主checkout與舊candidate。Task1.4完成，整體4/22（18.2% task計數）。下一步2.1先精確採用3f45d134來源、跑Node baseline再最小counter/clock/Player修正；不整批cherry-pick、不消耗provider/probe額度。全部Unity新能力及最終完整遊戲驗收仍NOT_RUN。

## Unit2／Task2.1最小能力修正候選

- Source採用精確候選3f45d134的5份scripts、PerformanceProbe.cs/.meta與PerformanceScopeEditTests.cs/.meta，逐檔copy/hash核對；不採用其他候選內容。Adopt baseline Node15 PASS；新增回歸最初18 tests=15 PASS/3 FAIL（counter metadata、100ns與重複adapter缺口），修正後24/24 PASS。此為預先新增測試重現，不重設原E12兩輪或任何provider額度。
- Node同時核對Render/name/TimeNanoseconds及唯一性，來源C#按Render/Memory、預期unit及唯一catalog選取並保留同名候選；新增3個EditMode測試驗證來源選取。UTC字串的100ns以BigInt運算，bytes以十進字串/Int64界線，legacy數值aggregate超safe integer拒絕；舊schema只供歷史診斷，沒有正式能力PASS。
- helper新增離線clock fixture模式（不Get-Process/CIM/PDH），使用同一production decoder驗證明確timezone、100ns、DST ambiguous/invalid及frequency；不硬減8h。capture須明確source timezone並核對host規則，保存raw/frequency、查詢前後PID/start及每秒deadline缺槽；未知Player來源mapping保持OBSERVED_SOURCE_REQUIRES_PLAYER_VALIDATION，schema2 validator拒絕，未取得Player證據不改成已驗證。既有launcher尚未接入明確clock contract，因此新capture尚不可用；不可啟動probe或標2.1完整完成。
- schema2檢查完整adapter name/LUID/phys、canonical duplicate、PID/startAfter，series固定adapter集合、invalid不更新100ns高水位；缺失或未知fail closed。memory CSV保留精確bytes。
- 發現驗證scope缺口：scripts/unity-validate.mjs固定testInventory，validateTestInventory要求exact total；新增PerformanceScope/Telemetry必遭拒絕。已提出僅將此runner加入allowlist以登錄新增測試的範圍追加，未收到同意前不改。新增Unity tests仍NOT_RUN，2.1未勾選。後續還需完整counter/clock/identity契約、Unity編譯/測試及unit2完整pipeline，不把Node PASS替代它們。
- 本候選在隔離feature branch，本機checkpoint用於保全，不代表stable main、已推送、已合併或正式APPROVED。進度4/22（18.2% task計數）；没有新GPU sample、短probe、Unity/Player或Jev provider呼叫。
- Partial checkpoint14b4e91獨立review發現MEDIUM PRODUCT_FAILURE：CSV parser誤用gcUsedRaw/gcReservedRaw/usedRaw，實際來源為allocated/gcUsed/gcReserved/used，造成四欄大整數被Number截精度。第1輪修正只改為六個真實bytes欄名，既有case24逐欄驗證大整數、負值/小數/前導零/Int64溢位；24/24重跑PASS，未新增provider/Unity執行。舊checkpoint保留失敗，待新exact SHA獨立核對；此修正不重設任何舊預算。

### Unity runner測試登錄範圍追加

- 2026-10-08使用者回覆「同意」，對應精確提案僅追加scripts/unity-validate.mjs testInventory。現有EditMode164案例全部保留，再加PerformanceScopeEditTests4及PerformanceTelemetryEditTests3，預期171；PlayMode47不變。不改exact total邏輯、stage argv/timeout、source safety、Packages、素材、門檻或runtime。
- 追加後先做Node工具與OpenSpec/差異檢查、獨立exact-candidate審查，保存clean candidate，再用原Unity五階段runner。新Unity執行結果必須綁定新SHA及run ID；先前候選24/84只作歷史，不移作實測。工具pipeline不是E12正式效能或E13完整自然操作驗收。
- 輸出限定新exclusive leaf release/e02/unit2-counter-validation-v1。此runner不啟用-e12Probe、不呼叫GPU telemetry helper、不消耗3短probe/12成本probe。沒有背景Jev provider或美術製作；SPEC仍4/22（18.2%），2.1待完整條件齊備。

### 首次 Unity 編譯失敗與相容修正

- candidate 933188a9e4b65a6d7f826bb8c60a8f66ea5fdbef，run f5686ca2-f62e-4800-ae08-fa556be8ec97，輸出 release/e02/unit2-counter-validation-v1：compile FAIL（exit 1，非 timeout），PerformanceProbe.cs:140 報 CS1501，UseDummies 無雙參數 overload。EditMode、PlayMode、build、Player NOT_RUN；保留原始 result.json/Editor.log，不覆寫。
- 分類 PRODUCT_FAILURE。採用來源呼叫依賴未納入 allowlist 的 controller overload；main 僅單參數 API，HitTargets 預設 seed=7、readonly RNG，沒有現成 reseed 介面。獨立審查接受最小修正：呼叫原 API，先用 RequireControllerSeed 驗證 seed；不支援者保存 UNSUPPORTED_CONTROLLER_AI_SEED 並退出，再開始任何戰鬥/crowd 修改。
- 新增一項 EditMode 測試驗證 7 接受、11/23 拒絕，Telemetry 3→4、預期 EditMode 172、PlayMode 47。沒有修改 controller/combat、預設 RNG 或素材。三 seed AI 能力仍缺；此修正不完成 2.1、不重設原 E12 或既有修正預算。
- 新 exact SHA 須先審查，才可使用新 exclusive output release/e02/unit2-counter-validation-v2 重跑原五階段。尚未取得新版 Unity 結果，SPEC 仍 4/22（18.2%）。

### 修正後五階段實測與完整包追加提案

- 原 project Temp/UnityLockfile 建立於 2026-10-08T14:04:51.9300278Z，吻合 v1；PID45920 已退出。現存 PID22688 的 command line 為 Unity Hub resources/unity.exe serve。preflight 禁止移除/接管 lock，故未刪 lock、未終止 Hub。獨立審查接受同 repo 內新隔離 worktree .worktrees/unity-e12-capability-validate、branch codex/unity-e12-capability-validate，同 exact SHA da959b40f229f2af66c52fd7bfd82353e422cc95；四個固定官方 tgz 採用前後 SHA-256 一致，runner 自行驗包，新的 HEAD/clean/no lock/no output 核對通過。只執行已批准的一次 v2，沒有重設預算或連續新 worktree 重跑。
- Run 3ecafcf1-eca2-4985-a76e-c6eec0f4c694，結束 2026-10-08T14:21:18.323Z；輸出在上述新 worktree 的 release/e02/unit2-counter-validation-v2。結果 PASS_LOCAL_ENGINE_FOUNDATION，compile/EditMode172/172/PlayMode47/47/build/Player 全部 exit0 verified；tests failed/skipped/inconclusive 皆0。result.json SHA-256 c42126ada4e3875537615aebe07d1eac821a411b29ac28f6d99769c7b8d62ecb。runtime 為 Unity6000.6.4f1、D3D11、URP、Linear、1920x1080、renderScale1、vSync1/cap60、batchMode false、focused true、errorCount0、pendingCaptureGates0；source clean。這僅同版基礎 pipeline，不是自然玩法或效能驗收。
- 已實際查看 Player scene.png：衣料仍有大片拉伸/尖角，保留資產品質 FAIL，未修改資產。PlayMode Editor.log 有 persistent allocation leak 訊息（79 individual allocations）；log SHA-256 feea3837adf3de26346bbb075d1bc2aa75abc6f611d297b9bf87b50022727107。runner 基礎 gates通過，不代表該 memory 風險解除；後續定位及正式 memory/soak 不可跳過。
- 獨立審查確認 launcher 所需 validation.playerPayload 未由 runner 產出，完整包追加待人類批准（精確提案見 PLAN）。不補寫 v2 為已取得全包 provenance，也不啟動短 probe。
- 審查另重現既有 snapshotPayload 一般 {} 容器漏掉根目錄 __proto__ 檔案。原 allowlist 內先加入新增/替換/刪除回歸，RED=1 FAIL，再改 Object.create(null)，全套 E12 Node25/25 PASS。這是 helper 完整性修正，非新增 runner 授權實作；待新 exact SHA 審查。五階段結果只屬 da959b4，不移作之後 helper 候選的 runtime PASS。SPEC 仍4/22（18.2%），2.1與完整遊戲驗收未完成；無背景 Unity/provider/probe。

### 人類接受已展示衣角的限定視覺例外

- 使用者原文「趙雲衣角拉伸透過調整，允許通過」，經釐清明確回覆「接受目前已展示的衣角拉伸，作為限定視覺例外」。此決定修改該限定外觀的接受條件，沒有新增 runtime／資產修復、完整包 runner scope 或遠端授權。
- HUMAN_ACCEPTED_VISUAL_EXCEPTION 綁定 code da959b40f229f2af66c52fd7bfd82353e422cc95、run 3ecafcf1-eca2-4985-a76e-c6eec0f4c694、GLB SHA-256 7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33、scene.png SHA-256 2ef482a1fb32834cd0c9a1059868449cf7f88897a01fda9243fc5b1cf9370dd8（已重新核對）。歷史衣料形變觀察與 raw 保留；最新該畫面已展示衣角現象經人類接受，不再單獨列為阻擋，也不稱已修復。
- 例外不擴及其他部位、未展示的姿勢／動作或後續版本；骨架、weights、握點／plant／root、tip/tipBase、fallback、自然操作及 review/merge/postmerge 仍按原標準。未取得美術 delivery，3.1–3.5不勾選。SPEC 仍4/22（18.2%）；此文件修訂未重跑 Unity，先前基礎 PASS 僅屬原 SHA。完整包追加問題仍待答覆，無背景工作。

### 完整 Player 包 provenance 工程追加

- 2026-10-09 使用者「同意」對應尚待答覆的完整包範圍問題，批准 scripts/unity-validate.mjs 及 scripts/tests/unity-execution.node.mjs 的精確追加；helper 為原 allowlist。獨立預審接受固定 build baseline、Player 退出後先保存完整 after/差異再驗報告、失敗保持 BLOCKED，沒有 provider/probe/remote 或門檻額外授權。
- 重用已修正 snapshotPayload，新增純 comparePayload 只比較 own keys、bytes、SHA-256，added/removed/changed 排序穩定，不修改輸入。build 的 payload-build.json 與 run.playerPayload 固定；Player 成功退出後寫 payload-after.json/payload-comparison.json，差異觸發 PLAYER_PAYLOAD_CHANGED，catch 保留 baseline/差異/error；快照讀取失敗直接原錯誤 BLOCKED，不填空清單。Player stage 失敗保留原 failure，不冒稱包比對完成。
- 工具 baseline runner84/84、E12 Node25/25 PASS；新增5項 runner 回歸驗證完整包 JSON/非突變、DLL及GLB新增/刪除/同大小替換、特殊鍵/穩定排序、空包與junction逃逸，runner89/89及E12 Node25/25 PASS。fixtures 僅清理本次建立且已核對根邊界的路徑，junction先 unlink，target保存核對。
- 原有五階段、Edit172/Play47、argv/timeout、exe/GLB獨立hash gates維持；舊v2沒有 playerPayload，沒有補寫舊run。新版待 exact SHA 終審後在乾淨 validation worktree 執行一次新 exclusive release/e02/unit2-payload-validation-v1。此工程不完成2.1或2.4全部條件；clock/Player來源mapping/三seed與visible/timing/workload仍缺，SPEC4/22（18.2%）。

### 完整包同版五階段結果

- exact candidate 204908457141c6d883af2356a2efe04afe3a3c1b 獨立終審 accept 後，fresh-check validation root clean/no lock/no output 並以 ff-only 從 da959b4 更新；未刪原 worktree lock 或舊 run。run 54772c21-3028-498f-bd1d-20128800588d，於 2026-10-08T22:09:32.669Z（臺北2026-10-09 06:09:32）結束；compile/Edit172/Play47/build/Player 全部 exit0/verified，result PASS_LOCAL_ENGINE_FOUNDATION。輸出為 .worktrees/unity-e12-capability-validate/release/e02/unit2-payload-validation-v1。
- 完整包319個普通檔案、175654092 bytes；baseline 與 after 都為 SHA-256 ed62502ad5f0338c20bd25c521f5981cb5d388f8c33142a65d97fc33e76dbe57。comparison unchanged=true，added/removed/changed 全空；comparison hash b333f3facef2151504284eb99c692b347f52de4c907c69db37ec1641ccb95060，result hash 996f0cf14e0427acc3fa5067ea8a3f93c2bd94c4480897c84ed3d78f9a6a71de。重新從完整包讀取並與保存 baseline/run.playerPayload/after 比較亦通過；非僅相信 comparison 字串。包前後一致只證明觀察時點一致，不證明期間沒有短暫改寫。
- validation root source clean/no project lock；原 runner stage/test gates未變。PlayMode Editor.log:1537 仍有 persistent allocation leak，本次87 individual allocations，來源未定位；不以跨run數量差異推定memory slope或已修復。人類衣角例外維持原 artifact 界線，本次沒有新增自然操作或全面視覺接受。
- 本次完成完整包工程及同版驗證，未啟動短probe/GPU helper/Jev provider、未push/merge或發布。下一個三seed controller最小追加已有獨立方案接受、已向人類提出精確scope問題，尚待答覆；未實作。clock/來源mapping/visible/timing/workload及正式退出仍缺，SPEC4/22（18.2%）。

### 三 seed 的最小 controller 銜接

- 2026-10-09 使用者「同意按照建議實作」，批准新增 ZhaoYunController.cs 至 scope；獨立實作前審查接受同一最小方法與四項 PlayMode cases。保留原 UseDummies(dummies)，新增雙參數 overload，Build 的 default 為 HitTargets.DefaultSeed 並傳既有 constructor；一般初始化/pressure crowd/單參數仍 seed7，沒有修改 Combat、AI、difficulty 或 Restart RNG。
- Probe guard 允許7/11/23並拒0/8/uintmax；report、spawn與實際 controller AI seed 使用同一欄位。boot 仍20/spawn7/AI7，launcher三 seed及正式短探測未完成，不以 guard/API 成功替代實際樣本。
- 新 PerformanceTelemetryPlayTests：三個 seed 全用固定相同 ProbeSpawns(20,7)，對照獨立 HitTargets/CombatSimulation；驗實際 HP/cooldown/scale/狀態/座標/速度/engagement/token/事件及合法空输入180frames；11/23與7的實際初始亂數結果不同。Restart 保持 targets identity且延續流；重建 targets才回到初始序列。另核對原單參數與顯式7的完整初始/逐幀等價。所有 fixture 關閉 Update，owned camera/Effects parent在首次Tick前建立、OfflineAudio不改接scene listener，只清理自建root。這不是自然遊玩或音效驗收。
- 實際 source 為3個 TestCase＋1個 Test；僅新增 inventory PerformanceTelemetryPlayTests=4，Play47→51，Edit172保持，其他class/count及 gates 不變。Unity 新增案例仍 NOT_RUN，先離線/source/strict/diff檢查與 exact SHA review，再一次新exclusive release/e02/unit2-seed-validation-v1 五階段。SPEC4/22（18.2%），不重設原budget，無provider/probe/remote動作。

### 三 seed 同版 Unity 驗證結果

- exact candidate `6df38c6ce22191153e4660d1cba415bf85623b35` 的獨立 source review 無阻擋 findings 後，validation worktree clean/no lock/no output，以 ff-only 對齊；run `7a8f9dc8-9f7e-4cdc-861d-9bed7836a7e8`，exclusive `release/e02/unit2-seed-validation-v1`，end `2026-10-08T22:48:29.606Z`。compile/Edit172/Play51/build/Player 全 exit0/verified/timedOut=false，failed/skipped/inconclusive=0；四個新 seed cases 實際通過。只證明 seed API 與 fixtures，boot 仍20/7/7，未執行三 seed probe。
- 完整包319檔、175654169 bytes；build/after SHA-256 同為 `3f8c1b469b9549dd401af15ce5dc3d4692bad9c45a620ed00733f491b2e83a19`，comparison `b333f3facef2151504284eb99c692b347f52de4c907c69db37ec1641ccb95060`，result `916cb140fc8d4f1dcddef856859ae64a3446750ff809178f5fa26411f7d1aac8`。fresh snapshot 實檔與 baseline/run.playerPayload/after 相符，added/removed/changed 為空。validation source clean、project lock 不存在；原 worktree 的歷史 lock 保留。
- Player readback：6000.6.4f1、D3D11、URP、Linear、1920×1080、scale1、vSync1/cap60、focused=true/batch=false、errorCount=0/pendingCaptureGates=0。已查看本次 scene.png，仍有衣料形變；不延伸原 artifact 的限定例外，也不宣稱視覺修复或完整自然遊玩通過。PlayMode Editor.log:1537 仍報87 persistent individual allocations，來源未定位，不以工具 PASS 消除此缺口。
- Jev 本機 deterministic governed/before_delivery 路由要求 architecture review，provider_called=false；observation `909076e2-48f3-4d1b-8155-ae42283fb1f2` 已回報 caller_reported completed（只指review派工完成，不是遊戲/SPEC完成）。首次呼叫被自動審查拒絕缺少可核實 envelope；查本機 decision.py 確認 required gate 在 evaluator 前退出，補具體本機限定 envelope 後成功，未呼叫 provider。
- SPEC 維持4/22（18.2%）。clock/Player來源映射、window/visible/timing/workload、正式review/merge/postmerge與完整遊戲仍缺。未push/merge/發布，未啟動probe/helper或增加額度。下一個已批准 scope 內 M1 純 ledger/fixtures 的方法審查接受，僅驗證資料完整性，尚未runtime接線或來源映射。

### M1 純 ledger 與 fixtures（來源／callback 尚未接入）

- 以既有 M1/M4 方案及批准 allowlist 新增 `PerformanceFrameLedger.cs/.meta`，pre-implementation 獨立審查接受 fixture-first 最小契約。只驗值型 raw frame 與不可修改保存列；不用 Stopwatch/UTC/provider/callback 實採，也不修改玩法、品質、資產、量測門檻或預算。相同目的本地盤點未找到既有 ledger 可重用，故在列名範圍內自建純 validator；既有 runner 的精確 testInventory 延伸實際 case 數。
- 固定 UUID/camera（負 camera ID 合法、0拒絕）/clock domain/正 frequency；sequence 從1連續、frameCount從首筆非負值連續。nullable 表達 missing，tick0/frameCount0/dt0合法；callback ticks非遞減、wall interval嚴格正。整數比較及差值不轉 double，long/int上限拒絕回繞。UTC保存讀取窗口、DateTime ticks和precision，只檢bounds/順序/倒退，沒有UTC↔monotonic mapping通過主張。
- wall 僅連接相鄰結構有效列；首筆或前筆失敗保留 MISSING，禁止跨失敗列補接。phase為來源wall end的半開区間 `[warmupStart,measureStart)`／`[measureStart,drainStart)`／drain；interval兩端跨區記 AMBIGUOUS，原差值保留而不視為有效measure。結構有效與wall有效分開；所有列的 FormalSourcesComplete 及 ledger FormalSummaryAllowed 永遠 false，尚無CPU/GPU/visible/window join。
- 固定capacity，滿時保留既有列、首次拒收raw/拒收總數/overflow永久狀態；拒收raw不宣稱全保存，沒有無界overflow list。多個failure reasons與原值保留；caller改input或嘗試改reasons不能覆寫保存列。尚未包含完整camera descriptor、輸入/workload快照、來源對齊或runtime讀回；本候選只是M1資料拒絕基礎，不完成2.1–2.3。
- 新增8個 Edit fixtures 涵蓋正常連續/合法零值與負camera、bad contract、缺樣/不跨缺失、identity/domain/frequency/重複倒退斷號、多個理由、等tick/零wall/整數極值、精確phase邊界/跨界、UTC與tickbounds/倒退、capacity滿/多一列與不可變性。TelemetryEdit4→12，總Edit172→180，Play51保持，其他counts/gates不動。Node runner89/89、E12 Node25/25、OpenSpec strict PASS；C#compile/Edit180/Play51/build/Player仍NOT_RUN，待exact SHA review及同版Unity。
- 原87 persistent allocations及全部clock/visible/timing/workload/完整遊戲缺口保留。SPEC4/22（18.2%），沒有probe/helper/provider/remote/background工作。

### Player clock metadata-only 實作準備（尚未執行）

- 使用者明確批准 b361d76 的一次 Player 時鐘對照、最多三窗口；先依獨立 pre-implementation review 鎖定一次 metadata-only 批次。四次指定 CIM、一次 Registry64 bridge 註冊讀取、一次三個固定系統檔版本/hash群組，各來源實際2s、controller總20s。不得 retry、補查或執行 registry 值；完成每步 CreateNew 保存。
- 保留原診斷模式；新明確 switch 在所有 PDH/native/counter code 前退出。只分列 bridge/schema/environment；producer binding=null、loadedModuleProven=false、clockMapping=UNVERIFIED，全部 metadata 成功也只記 CLOCK_MAPPING_BLOCKED，不能啟動 Player。純 verdict 拒絕來源順序/身分/時限/偽造VALIDATED或PASS；缺證據不升級。
- E12 Node29/29（含 PowerShell AST 與原生struct離線ABI）、OpenSpec strict PASS；metadata/Player/counter windows NOT_RUN、0/3。沒有本候選 Unity runtime PASS 主張。先 exact-SHA 獨立審查，接受後僅執行此單次前置批次。SPEC仍4/22（18.2%）；舊診斷額度、三seed短probe與12成本probe不變，沒有remote/background工作。

### Player clock 單次 metadata 執行：ENVIRONMENT_FAILURE／BLOCKED

- exact source `ef2a5b7b47885e731ea816bf3d24ffbeae3440b9`、script SHA256 `66227003856abd592c33f564a4bae0e023a4bbb07d6fb9a706eed38b7bc9e7eb` 的五檔完整 diff 經獨立 reviewer 審查無阻擋 findings，僅接受一次 metadata-only。runner89/89、E12Node29/29、strict PASS；不是正式APPROVED或Unity runtime驗收。
- run `1d9c7775-cf31-481a-a52e-56129db70cac`，exclusive `release/e12/player-clock-v1`；controller20s上限，實際460.3457ms，child exit1，end `2026-10-09T07:04:26.487Z`。command/controller-result/stdout/stderr保存；stderr在script:21的record初始化回報 Get-FileHash CommandNotFoundException，metadata子目錄空。source HEAD/status/script前後一致。獨立 reviewer 親讀上述證據及控制流程，接受 ENVIRONMENT_FAILURE/BLOCKED 分類：CIM0/4、registry0、固定檔案群組0、Player未啟動、counter0/3。這次批次嘗試已發生，無重試；缺失metadata不能補成成功。
- 非provider的命令可用性對照：相同 Node→powershell.exe 5.1.26100.6899，繼承PSModulePath包含PowerShell7時 Get-Command Get-FileHash exit1；只刪除該child env的PSModulePath後exit0，命令來自Microsoft.PowerShell.Utility。這是環境隔離修訂的實測證據，不是provider來源資料。既有offline測試改為pwsh與powershell雙runtime、先解析五個必要cmdlet、各自AST/ABI；29/29 PASS，沒有執行metadata script或任何CIM/PDH。
- PLAN已記精確v2提案：只額外一次相同metadata批次，child自建module path，fresh exclusive leaf，其他來源/時限/停止條件不變；尚待人類決定，未執行。SPEC仍4/22（18.2%），task2.1/正式E12/完整Unity遊戲未完成，沒有background/remote工作。
- v1 SHA256：command `5756a6b0b11cbccb9f41c406100d8e36d49205d5326bc853b69c3bf79271783d`；controller-result `43b5cf4ad39ef5b18b377a9134370b43e3b0d13125a1dca70bff2ca5de97f982`；stderr `68d2283b1646eebd8c82330c3d07402a11009ced4b0072100a53764da3f4956c`；空stdout `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。raw為ignored本地證據，tracked記錄保存定位/hash，未外傳。Jev deterministic architecture_review observation `803032f1-5fcb-423b-a531-b2d6d83e8977` 已回報 caller_reported completed，僅review派工完成，非clock/SPEC完成。
- 獨立 reviewer 對 exact `1f7b600df1153267e02f6368a2563583082173c4` 三檔完整差異無阻擋 findings，親自重跑雙runtime離線測試1/1 PASS、四份v1 evidence hash全相符、v2尚不存在。advisory accept只接受此失敗交付／具體重試提案，沒有新增執行授權或正式APPROVED；已提出一次metadata重試的人類決定，回答前保持NOT_RUN。

### M1 純 ledger 同版 Unity 結果

- exact `6edf1e0c008a74db02fc541f73b76e45a12c17ba` 經獨立 source review 接受後，validation worktree fresh clean/no lock/no output，ff-only 對齊。run `c3867e43-9b1c-4121-ac1a-e5dda5f37339`，exclusive `release/e02/unit2-ledger-validation-v1`，end `2026-10-08T22:58:40.339Z`；compile/Edit180/Play51/build/Player 全 exit0/verified/timedOut=false，failed/skipped/inconclusive=0，八個新 ledger cases 全 Passed。
- 完整包319檔／175661980 bytes，build/after 清單同 hash `474e32adfce14824ce8b81815089a120bf5f7aab0ca158529131a8e1d38dc002`，result hash `46e227208b9cc7f32f12f5a3c9e02293a67445318883f39ef30e6d3e60dbbf7c`。主控及独立 reviewer 各自重新讀取實檔，與 build baseline/after/run.playerPayload 逐項一致。source snapshots 相符、checkout clean、project lock不存在。Player readback 6000.6.4f1/D3D11/1920×1080/focused=true/errorCount0。
- PlayMode Editor.log:1537 仍報79 persistent individual allocations；前次87→本次79不證明leak改善或memory slope。licensing access-token更新訊息未阻擋本輪測試，但不能稱整份log零警告。独立驗證審查無本scope阻擋 findings，僅advisory accept，非formal APPROVED/merge/SPEC complete。
- Jev本機 governed/before_delivery observation `aac25f6a-8180-41bb-80ec-f0499689afa8` 要求architecture_review/provider_called=false，已回報caller_reported completed，僅review派工完成。未採樣、未provider、未push/merge；沒有背景工作。M1尚無runtime/source join、humanPlay/performanceAcceptance=NOT_RUN；SPEC4/22（18.2%）。
