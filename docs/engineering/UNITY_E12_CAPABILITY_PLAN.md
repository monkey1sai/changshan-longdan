# Unity E12 能力恢復：定位證據與方案

2026-10-08（Asia/Taipei）；第一個 eligible 單元 U1，對應 OpenSpec tasks1.1–1.3。規格審查版本 `6c5282bf752e71dd54e69de14819f32b74d0dd5c`；當次使用者指示「你審查spec, 通過之後開始spec」支持本機執行準備，不自動授權push／PR／merge／provider／美術傳送。原E12兩輪修正預算保持用完，本次未修量測器。

**目前狀態（task1.3方案整理）**：task1.1／1.2完成；以下歷史追加段保留當時狀態，不能當目前台帳。完整方法及下一單元範圍見文末「Task1.3完整方法」。方法草案不等於工具可用；runtime新範圍批准、U1正式approval／merge／postmerge仍未取得。

## Baseline與新證據

本次fetch origin/main確認仍為 `805db86f67ab2be152dea8abe57ca47f4e735fb7`，包含E11 merge `be04336f…`。E12候選 `3f45d134…` 工作樹乾淨；相對main有量測source，也少PR44的 `.codex/jev.json`／orchestrator.json／JEV_REPO_USAGE；不得把反向差異當應刪項目或整批套用候選。

保管位置：本worktree `release/unity-followup-u1/`（ignored、local_only），原raw仍於 `.worktrees/_clones/e12-a/release/e12/probe-c/`，未搬移／覆寫。

| 產物 | SHA-256 | 結論 |
|---|---|---|
| source-index.json | 6b62b98fce52de7466b05d859af5be752b25335b9e5e63f8d1a6dcdb78d22830 | 11份原raw路徑／bytes／hash；重讀全部一致 |
| raw-analysis.json | 01acdf96e34dbe186cc5184f00f7d7323b7df0ec086569ee59d2c18d87105ace | 601frame、15GPU样本；report／frames hash與原result一致 |
| clock-diagnostic.json | e2fdbffff28d70e25f65a4ad5ec8a48bb518dc1543cc5a2decfa38237224abc1 | 3筆CIM全拒絕存取；沒有時鐘值；ENVIRONMENT_FAILURE |

已確認raw的 `Draw Calls Count` metadata為category=`UI Toolkit`、unit=`Count`、601 reads。source `PerformanceProbe.Counter` 只檢查Name並取第一個handle，對同名不同category沒有辨識；這支持特定counter原因，並非效能結論。[Unity6000.6 Rendering profiler](https://docs.unity3d.com/6000.6/Documentation/Manual/ProfilerRendering.html) 明列 `ProfilerCategory.Render`。

VRAM原provider與query相差約8小時，15樣本仍0有效。[Microsoft Win32_PerfRawData](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-perfrawdata)只描述100ns與frequency；[PERF_DATA_BLOCK](https://learn.microsoft.com/en-us/windows/win32/api/winperf/ns-winperf-perf_data_block)描述UTC SystemTime與PerfTime100nSec。這些不能證明本機GPU WMI provider應直接作FromFileTimeUtc或固定減8h。根因UNKNOWN；本次3筆CIM只有存取失敗，不是provider本身FAIL。採樣預算已用完，不加host重試、不改ACL／時區／provider。

## 建議後續方案（尚未實作）

### A. Counter身分

採明確category/name/unit描述：Draw Calls=`Render`／`Draw Calls Count`／`Count`；其他counter各自核對原始catalog。找不到、重複精確匹配、unit不符一律UNKNOWN；先保存候選catalog，再建立recorder。測同名UI Toolkit先列／Render先列兩種順序、missing、錯unit與無valid sample，不依enumeration順序。解析器亦核對完整metadata，不只name。

### B. VRAM時鐘

下一次受審查的窄診斷須同query-window比較GPU WMI、PerfOS reference與獨立UTC，保留raw字符串和frequency，再判定相同／不同時鐘；可評估受支持的PDH原始來源，但必須先證明timestamp／PID語義，不能因拒絕存取擅改provider。新方法及新增採樣額度待批准；原3筆失敗永久保留。原freshness／identity／有效高水位均不變。

### C. 真正可見數

候選方案為主camera的全解析度ID/depth pass：使用鎖定場景相同projection／viewport／深度、與實際soldier幾何一致；城池／趙雲／其他遮擋物寫depth，士兵寫穩定ID；全畫面至少1有效pixel才算visible。GPU readback帶capture frame與camera ID、dimensions、asset hash；回傳未知／error不填0。透明／特殊材質、MSAA與alpha coverage尚須方法審查；不能用簡化proxy或低解析度漏掉可見士兵。

接受測試：全遮擋=0、局部露出=1、視錐外=0、兩兵互遮、另一camera不污染、1pixel邊界、ID重用／死亡、readback失敗。這是待驗證方法，不是可用工具。Instrumentation可能額外draw/GPU負載；需相同合法路線on/off成本對照，保存差異並在正式跑前review登錄誤差界線。未證明可接受成本仍BLOCKED，不以測後扣除常數得到PASS。

### D. Frame與時鐘對齊

[Unity6000.6 FrameTimingManager](https://docs.unity3d.com/6000.6/Documentation/Manual/frame-timing-manager.html)說明四幀延遲且未保證回傳；[FrameTiming](https://docs.unity3d.com/6000.6/Documentation/ScriptReference/FrameTiming.html)有frameStartTimestamp及CPU timer frequency。不能直接用當前Time.frameCount配上LastValue，亦不能把所有recorder硬移4幀。

建議帶來源capture frame、CPU timestamp/frequency、arrival frame與來源方法；針對實際API建立mapping並測已知pulse、重複、warmup邊界及收尾drain。保留wall Stopwatch、foreground PID/focus/minimized與gameplay dt不同口徑。每秒記憶體保留query-window，不插值冒充per-frame VRAM；無法唯一對齊即UNKNOWN。CPU active維持原Profiler active語義，不把含等待的FrameTiming總值直接替換原gate。

### E. Workload與品質

固定seed／合法輸入路線的交戰、無雙、倒地峰值與四種敵數；不以補血／無敵／teleport維持負載。先在短能力probe證明事件覆蓋，再由reviewer在正式取樣前鎖路線。美術資產仍PREPARED_NOT_SENT，工程不製作角色。正式E12須第2工具單元與第3品質整合完成，原數值與memory gates全部沿用。

## 出口

本次已開始U1、counter原因定位有證據、raw保全PASS、原E12 Node15 tests PASS；新Player／visible／timing實測NOT_RUN。CIM新時鐘證據受阻、正式review/merge/postmerge未齊；tasks1.2／1.3／1.4不勾完成，不進第2單元。先解除窄時鐘診斷的環境與額度條件並review方法，再依原phase gate執行。

## 追加：已授權host診斷

使用者明確「同意」後，在host執行新增最多3筆唯讀GPU／PerfOS timestamp、frequency和query UTC。這是新授權診斷，保留先前sandbox3筆失敗及原E12兩輪budget；沒有改ACL／時區／provider或啟動遊戲。新增3筆均成功，存取阻礙已解除，UTC可靠mapping尚未證明。

| 新產物（同local-only目錄） | SHA-256 |
|---|---|
| host-clock-diagnostic.json | 155443da2c2bb91747f7a916cb82212180d999a9f2b53b330e89d428e1c0519e |
| host-clock-analysis.json | 2d7f2dfcbfd27d657806a53a328af5d8d1ff587640f348ecb22326d190c271b1 |

採樣UTC：2026-10-08T08:13:05.1750759Z–08:13:07.9162601Z（Taipei16:13）。分析用JavaScript Date.parse，毫秒精度，不宣稱100ns測量精度。

| sample | 合併query window(ms) | GPU比query end超前(ms) | PerfOS比query end超前(ms) | GPU－PerfOS(ms) |
|---|---:|---:|---:|---:|
| 1 | 2673 | 28799929 | 28799985 | -56 |
| 2 | 36 | 28799974 | 28799989 | -15 |
| 3 | 31 | 28799975 | 28799989 | -14 |

GPU `Frequency_Sys100NS=10000000`、PerfTime／Frequency_PerfTime皆0；PerfOS Sys100NS frequency及PerfTime frequency均10000000。第一筆combined query超過既有2s門檻，不能以其作有效freshness樣本；其餘兩筆亦因UTC轉換未證明而不作PASS。此取樣不是指定Player、沒有PID／processStart／adapter／VRAM bytes，不能代替完整Player驗證。

**已確認**：約8h偏移在GPU與PerfOS兩個來源均存在；GPU-only錯誤假設不足。**推論**：共同WMI時鐘／FILETIME解讀或跨時鐘基準較值得優先隔離，仍無法憑3筆數據裁定根因。不要硬減8h或用query時間覆蓋provider timestamp。

下一個待審查方法是從獨立UTC FILETIME參考與Windows原生performance timestamp建立可追溯對照，核對WMI是否轉換／重標記，並驗證零偏移／非8h偏移／回退／重複／stale與query超限負例。實際原生擷取方式、窄允許欄位、額度與可靠語義須先受審查，不自動增加第4筆或切換provider。保持tasks1.2／1.3／1.4未完成；正式gate與runtime單元仍未開始。

方法審查的新官方依據：[PDH_RAW_COUNTER.TimeStamp](https://learn.microsoft.com/en-us/windows/win32/api/pdh/ns-pdh-pdh_raw_counter) 明定是local time的FILETIME。因此不能把換用PDH視為UTC解法，也不能推定WMI必然繼承相同語義。可先用來源契約與指定時區規則作local-encoded假設判別（含ambiguous／invalid local time失敗），再對同一instance作WMI／PDH／獨立UTC對照；GPU PerfTime=0不能當QPC fallback。這是待驗證提案，不是本次已實測或已授權的新增採樣。

## 追加：離線假設判別（無新增provider樣本）

使用者「let's go next」後，native `/root/unity_spec_review` 開始前advisory接受新增一個離線腳本及文件。重用.NET FILETIME／TimeZoneInfo；repo沒有既有相符工具。腳本 [Test-E12ClockHypotheses.ps1](../../scripts/diagnostics/Test-E12ClockHypotheses.ps1) 不呼叫CIM／PDH、不讀host timezone、不接入runtime。輸入鎖host診斷SHA；JSON使用DateKind String保存原始ISO Z與100ns字串。要求支援該參數的PowerShell，缺少時明報環境限制。

執行（此worktree根目錄）：`& './scripts/diagnostics/Test-E12ClockHypotheses.ps1' -OutputPath 'release/unity-followup-u1/clock-hypothesis-tests-v2.json'`。腳本拒絕覆寫既存output。

| 版本／結果 | local-only產物／SHA-256 |
|---|---|
| 初跑18 PASS／6 FAIL | clock-hypothesis-tests.json／cdd37bb2b0a2119edf0ddcbc908028fa3823514d88561570664976b2fbedf998 |
| correction1後26 PASS／0 FAIL | clock-hypothesis-tests-v2.json／e8531a69544eacd85a44e8f3b28e5d96c5bac66ef5c5b31709e46c3ced7661df |
| 被測修正後腳本 | cb78e34df443ea92507188ba6bf04ae61ec6c6ea6f2dd7ae9bd57aa2b1aa7ede |

初跑失敗分類TEST_FAILURE：PowerShell預設ConvertFrom-Json把ISO時間轉DateTime，隱式string丟Z／fraction，重播query被誤解析。修正只涉及離線腳本，不是E12 WMI偏移根因；原失敗保留。這一輪屬新離線工具，原E12兩輪與host3筆額度不重設。

26個case覆蓋精確Int64與100ns、非法格式／範圍／frequency／mode、explicit Z、Taipei／Kolkata／New York冬夏、DST ambiguous／invalid拒絕、UTC zone兩假設不可區分、query／lag／future精確與100ns越界，以及3筆×2來源重播。[ConvertTimeToUtc官方契約](https://learn.microsoft.com/en-us/dotnet/api/system.timezoneinfo.converttimetoutc)會在模糊時間預設選standard time，因此本方法先顯式拒絕模糊時間，不讓library自選offset。

**離線結論**：在明確fixture zone `Taipei Standard Time` 下，local-encoded假設的第2／3筆兩來源符合原query/freshness數值窗口，直接UTC解讀則FUTURE；第1筆兩種假設都QUERY_WINDOW_INVALID。這是指定假設的相容性，不證明host實際時區設定、不證明WMI繼承PDH語義、不證明指定Player有效VRAM。`providerMapping=UNPROVEN`、`playerFreshness=NOT_RUN`、`newProviderSamples=0`保留。

下一個最小實測提案：同一GPU counter instance於單一窗口取WMI raw／PDH raw（只timestamp/frequency／來源status與必要instance識別）、獨立UTC FILETIME及query-window，帶明確時區來源規則；先核對各API契約和精確欄位，必要時預先批准新增最多3個窗口。保留原始值，分別檢驗UTC與local-encoded假設；若兩者都可／都不可或跨來源無法定位即UNKNOWN，不選最接近query的結果冒稱真相。此新增provider實测尚未執行／授權；formal phase gate與tasks1.2–1.4不變。

## 追加：原生同instance對照完成

使用者同意上述下一步後，native reviewer `/root/unity_spec_review` 先審scope、再核對 [Capture-E12ClockComparison.ps1](../../scripts/diagnostics/Capture-E12ClockComparison.ps1) SHA `f7160447f18f8830a427fab83bd359c778d25ce6b2389a7484f847b569b00fc6`，才執行一次host最多3窗口。PowerShell syntax、C# compile、Windows x64 PDH_RAW_COUNTER ABI自檢PASS，沒有先行provider採樣。

來源契約：[PdhAddEnglishCounterW](https://learn.microsoft.com/en-us/windows/win32/api/pdh/nf-pdh-pdhaddenglishcounterw)可用language-neutral路徑；[PdhGetRawCounterValue](https://learn.microsoft.com/en-us/windows/win32/api/pdh/nf-pdh-pdhgetrawcountervalue)須另外檢查CStatus；[GetSystemTimePreciseAsFileTime](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getsystemtimepreciseasfiletime)提供UTC FILETIME；PDH timestamp local契約仍如上。WMI只取Name/timestamp/frequency，PDH只保存timestamp/status/type，FirstValue／SecondValue不輸出。

新增資料local-only，時間2026-10-08T08:46:55.6833708Z–08:46:57.0925704Z起，共3窗口至08:46:57.1190931Z（Taipei16:46）：

| 產物 | SHA-256 |
|---|---|
| native-clock-comparison.json | 8c3659674b4fad1b48e8e85041b513c3b84742f7cae9f3322138a53a93c29c36 |
| native-clock-analysis.json | 3376ec95502b3edf517cb4020e3fd521e7a5a6e28990e36948b3972d04a30252 |

全程鎖定 `pid_31848_luid_0x00000000_0x0000A44A_phys_0`；3窗均無error，PDH API=0／CStatus=0／CounterType=65792。取得host來源規則 `Taipei Standard Time`，適用offset480分鐘；未更改設定。每來源及combined window均用原生UTC FILETIME前後包住，時間差以Int64/decimal ticks計算，不經double FILETIME。

| 窗口 | combined(ms) | WMI query(ms) | PDH query(ms) | local解讀WMI比來源end落後(ms) | local解讀PDH比來源end落後(ms) |
|---|---:|---:|---:|---:|---:|
| 1 | 1406.0285 | 1121.9003 | 258.6139 | 9.9106 | 0.4472 |
| 2 | 13.2958 | 11.5492 | 0.0910 | 4.7886 | 0.5627 |
| 3 | 12.2319 | 11.6381 | 0.0916 | 5.2834 | 0.6959 |

6個來源查詢皆≤2s；按明確來源時區規則作local FILETIME解讀全部符合原lag≤2s／future≤250ms數值允收窗口；直接UTC全部為約+8h的FUTURE。部分PDH timestamp早於call start（窗口2約0.4717ms、窗口3約0.6043ms），保留來源取樣與呼叫時間差，不能宣稱全落在嚴格call start/end之內或同步瞬時取樣。本機這個counter來源的local-encoded解讀得到WMI／PDH／獨立原生UTC一致證據，舊helper直接FromFileTimeUtc的假設不適用此觀察來源。這不是所有WMI provider的普遍契約，也不是指定Player身分／VRAMbytes／freshness驗收。

原3筆sandbox失败、3筆host及本次3窗口都保留，各額度用完，不追加第4窗口。獨立reviewer確認可完成task1.2的定位證據與raw保全；定位證據可供後續提出精確的時間轉換修復：來源語義／platform/version限定、來源時區規則、ambiguous/invalid拒絕、原raw保留、100ns／query／PID／有效高水位門檻不變。runtime尚未改；task1.3的完整instrumentation方案及task1.4正式review/merge/postmerge仍缺，不能進第2單元。

## Task1.3完整方法：待批准的能力工程契約

### 來源、重用與界線

方法基準為本機checkpoint `1cd50908ca7fc26b4311b8b69cc69ae3049e4f97`，E12 source限定 `3f45d134da9b6ca997e1de0c8b5b2a2eec60c447`。此段由使用者「按照建議做」授權整理，開始前 `/root/unity_spec_review` advisory接受僅3份文件的scope。沒有新增採樣或runtime工程批准。

| 現有能力／查閱入口 | 採用方式與未滿足項 |
|---|---|
| PerformanceProbe.cs／Counter、Sample、Start | Extend catalog身分、幀ledger及輸出；目前LastValue、frustum、每幀Process.Refresh不能滿足完整能力 |
| e12-performance.mjs／parseProbeCsv、validateGpuSeries、metricSummary | Extend來源／schema／identity與coverage檢查；保留nearest-rank、原數值gate、有效高水位 |
| e12-probe.mjs、e12-process.mjs | Adopt UUID、exclusive output、full payload hash、own-handle cleanup；Extend有界退出與helper drain |
| e12-gpu-telemetry.ps1及既有離線時鐘fixtures | Extend精確字串／來源語義和1Hz排程；不盲目減8h、不用query UTC冒充sample timestamp |
| FoundationBuild.cs、FoundationRenderer.asset、FoundationURP.asset、Character.asmdef | 保留6000.6.4f1／17.6.0／Mono／D3D11；source顯示MSAA=1、renderer無feature，但實際Player模式尚須readback |

採Unity既有RenderGraph／AsyncGPUReadback、FrameTimingManager、ProfilerRecorder，以及既有Win32/.NET來源，不新增套件或native plugin。自建範圍僅必要ID/depth pass與來源ledger：repo沒有camera-specific pixel provider，現成frustum與Renderer可见旗標不足以證明遮擋後可見。官方[RenderGraph renderer list](https://docs.unity3d.com/6000.6/Documentation/Manual/urp/render-graph-draw-objects-in-a-pass.html)提供整合入口；特定17.6.0 API編譯相容性保持NOT_RUN。

### M1：單一真相與幀ledger

新schema版本為提案`e12-capability-v2`；舊schema只作歷史解析，不轉填新欄位。run manifest綁runId、source SHA、profile／asset／完整包hash、Player PID+processStart、Unity revision、URP version、D3D11、開發旗標、解析度與工具模式。所有來源帶status/reason；UNKNOWN使用null，不用0或省略行。

每個呈現候選幀建立唯一 `(runId, frameSequence, cameraId)` ledger，保留Time.frameCount、Update／render begin-end的Stopwatch tick/frequency、UTC前後錨點、gameplay dt、camera/render target descriptor、輸入與workload phase。wall保持既有連續end-of-frame間隔口徑，明示不是外部顯示器scanout；暖機/測量以來源幀monotonic時間決定，跨界間隔單列且不得混入180s。事件／ID／foreground快照與同幀綁定，不以async到達幀替代。

raw source分流為frame ledger、timing arrivals、counter reads、visibility requests/results、window events及memory samples，解析結果另存；不改寫raw。每幀最終狀態為COMPLETE／MISSING／AMBIGUOUS／INVALID。缺樣、buffer overflow或不連續保留行並阻擋必要指標；不得只對成功子集計算正式PASS。

### M2：指定camera的真正可見數

使用專用全解析度ID+depth target與RenderGraph feature，僅鎖定controller.ViewCamera的Game/base camera；禁止Camera.main fallback、其他camera或SceneView污染。鏡頭矩陣、pixel rect、target尺寸、renderScale、culling mask、LOD、renderer enabled、同幀pose與屋頂cutaway全綁快照。ID=run內單調序號，另存entity generation與capture-frame roster；0保留背景，死亡/重用不把舊readback解釋為目前entity。

以實際soldier mesh/submesh和同幀transform/skin/LOD繪製ID，實際城池、趙雲及其他遮擋幾何寫depth；深度方向、ZTest、Cull、ZWrite、排序及alpha coverage必須與主鏡頭可見渲染一致。不可默認override material保留原shader discard、透明或頂點位移。跑前盤點所有shader/material/renderQueue/alpha clip；第一版只接受經fixture證明的opaque、無alpha clip、MSAA=1、無動態解析度/相機stack與無改變幾何coverage的後處理。若實際場景不符，能力BLOCKED；另審覆蓋方法，不能關掉實際材質/特效以迎合工具。

**已知source限制**：候選`Assets/Character/Runtime/FeedbackView.cs:114–119`建立透明spark/dust/ring/pillar/trail，`Assets/Feedback/Resources/ChangshanFeedback.shader:18`使用Transparent queue，Blend/ZWrite按mode設定。因此opaque方法確定不能涵蓋現有完整交戰/無雙workload；不是僅尚未查到的風險。unit2可先驗證opaque fixture及其他量測能力，但完整visible/成本probe保持BLOCKED，禁止為跑12次成本probe關掉VFX。透明blend/alpha/coverage方法必須先另提交精確算法、所需pass/shader/檔案與邊界fixture，取得範圍審查/批准後才擴充；本scope不宣稱可解除全部visible缺口，不以候選opaque結果進formal E12。

全畫面至少1個有效pixel計為visible，frustum另存且不代替visible。R32_UInt格式與async支援須Player readback；不支援就BLOCKED，不降解析度。AsyncGPUReadback綁request ID、capture frame、camera、dimensions、roster/hash與arrival frame；有錯誤或逾期回null。官方[AsyncGPUReadback](https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Rendering.AsyncGPUReadback.html)指出回讀有幀延遲，這不保證本機成本可接受。

提案ring最多16個in-flight request，滿載即記overflow並停止有效取樣，不等GPU阻塞或覆蓋；先驗證full pixel readback正確性再考慮GPU bitset reduction，後者需另scope，不能暗換演算法。alive／engaged／attackers取同capture幀simulation，frustum取該camera bounds，visible取該pixel結果，五數與各自時序分列。

### M3：指定Player視窗與前景

在同幀render begin/end查GetForegroundWindow、GetWindowThreadProcessId、IsIconic、IsWindowVisible與client rect；先由launcher PID+processStart及Player HWND回報鎖定唯一主視窗。不能只因foreground PID相同就接受同process另一視窗；HWND重建、PID重用、rect改變、null HWND、focus與OS狀態不一致均記INVALID並停止該次有效量測。

Application.isFocused、focus callbacks、主視窗HWND/PID、foreground HWND/PID、minimized、client尺寸、UTC/monotonic查詢窗口全部保留。前後狀態相同只能證明兩個觀測端點；不能宣稱期間沒有切換。提案使用WinEvent前景/最小化事件ledger補充端點，事件callback也帶tick；未證明事件完整性、時間映射或發現途中切換則BLOCKED。OS前景不證明整個桌面無遮擋；正式跑需可見窗口與人工觀察，不以背景/runInBackground降載取得成績。

### M4：timing來源、映射、去重與收尾

FrameTimingManager每幀capture，GetLatestTimings批次拉取（提案64槽），每筆保留frameStartTimestamp、CPU frequency、CPU/GPU raw ms、arrival frame與capture調用ledger。以`(runId, frameStartTimestamp)`去重；同key同內容保留duplicate計數，同key不同內容BLOCKED。官方[FrameTimingManager](https://docs.unity3d.com/6000.6/Documentation/ScriptReference/FrameTimingManager.html)明列4幀延遲與可能GPU=0；零GPU為缺值，不是0ms。非timing recorder不套此延遲。

CPU timestamp不能僅因frequency相同就當Stopwatch或UTC。先在能力fixture用獨立編號的render workload pulse、callback ledger及同步Profiler trace核對來源frame，建立CPU clock↔ledger的有界映射；需要唯一frame correspondence，不能用nearest timestamp或固定arrival-4強接。映射校準前來源幀UNKNOWN；校準只界定方法，正式每run也檢查連續identity、頻率、回退、缺失與pulse/trace對照，未建立可追溯關係就保持BLOCKED。

ProfilerRecorderSample公開Value/Count未提供frame ID；每counter保存完整category/name/unit/options及讀取階段/sequence，不能以Count當全局sample ordinal。draw/GC/active CPU來源各自要frame mapping fixture；LastValue重複讀不算多個樣本。缺identity的counter保持UNKNOWN，即使數值看似合理。[ProfilerRecorderSample](https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Unity.Profiling.ProfilerRecorderSample.html)不是天然帶幀ID的來源。

CPU active能力gate採官方[6000.6 counter reference](https://docs.unity3d.com/6000.6/Documentation/Manual/frame-timing-manager-counter-reference.html)已定義的active語義：main排除等render/VSync/targetFPS，render排除Present；counter用ns，FrameTiming欄位用ms，不能混用。先前僅依API短文不足以完整描述語義，這裡明確補齊官方來源。仍須以同幀thread trace驗證實際category/unit/identity與該排wait契約，不能把未知映射當已通過；沿用已扣等待counter且不再扣一次，不自行用total或main-minus-present替換原active gate。若actual source不符，保持BLOCKED並另scope提出修正。CPU/GPU不相加，原max(p95(main),p95(render)) gate不變。

測量結束時凍結eligible來源幀清單，停止新增eligible ID request，繼續正常render收尾；提案最多16呈現幀或2s monotonic（先到即停）。drain幀不進分位數；最後eligible來源幀的delayed timing/visible必須到齊，否則MISSING。不以最後已收到的幀提早截短採樣、不ForceWaitAllRequests、不無限等待。64槽／16帧是提案buffer/drain上限，不是推定latency；queue飽和同樣BLOCKED。

### M5：1Hz記憶體與來源時鐘

RAM與GPU helper採同一run monotonic每秒deadline排程，query start/end各自保留原生UTC和monotonic前後界；不以query時間+sleep1s累積漂移，overrun記missed deadline，不catch-up突發採樣。移除每幀Process.Refresh負擔的方案只在後續批准runtime範圍執行。RAM保留PrivateBytes/WorkingSet、Unity GC used/reserved/total與各自capture幀/來源；每秒集合不是原子快照，最大query span與無法對齊都保留。

PID與processStart在查詢前後核對，adapter實例使用完整PID/LUID/phys key、counter type65792，全部adapter集合每次保存並檢查唯一性；出現duplicate key、集合变化未解釋、PID重用或任一必要adapter缺值不更新有效高水位。dedicated/shared/committed分列，只對同一有效query各adapter聚合，檢查整數overflow，不以shared當VRAM。bytes/FILETIME/QPC序列跨JSON用十進字串，100ns以Int64/BigInt處理，不經JS double或Date.parse丟精度。

local-encoded映射限定已核對OS/provider版本及來源時區規則，用TimeZoneInfo明確拒絕ambiguous/invalid；raw保留。來源/規則變更、UTC錨點倒退或相對monotonic異常保持INVALID並停止，不拿最近query選最接近的假設。沿用query≤2s、sample≥queryStart−2s、sample≤queryEnd+250ms及嚴格遞增有效高水位；無效樣本不降低高水位。Player來源映射及身份尚NOT_RUN。

sample關聯保留整個來源timestamp/query窗口與重疊frame/phase區間，跨warmup/measure或phase界線記AMBIGUOUS，不插值、複製或forward-fill作每幀VRAM。每秒預定槽缺樣就標missing；formal memory gate要求完整指定槽/首尾60s/最後20min coverage，不能僅用有效子集得到PASS。GC不強制collect；原4GiB/2GiB與drift/slope門檻不變，OS budget/paging仍UNKNOWN。

### M6：instrumentation成本及合法workload

同一完整包用三模式：B為最小wall/輸入/事件ledger（無IDpass/recorder）；T加正式timing來源；F在T上加所有counter/IDpass/window等完整量測。三模式共有同一個最小1Hz外部memory observer，使用M5完全相同的PID/start、adapter、時鐘、query-window與bytes來源，也都有最低限度foreground核對；不在B/T缺少memory時捏造對照。observer/helper的固定負擔算入所有模式，不稱B是無工具release。BuildFlags/FrameTimingStats保留一致。B→T比較wall；T→F比較同timing口徑CPU/GPU/wall，無GPU的B不捏造GPU差值。readback processing、helper、輸出與allocation都算成本；正式gate用F原始數據，包含instrumentation額外draw/CPU/GPU/RAM/VRAM，原draw另作來源分列，禁止減常數。

待批准成本probe：20及300人、seed7、normal、每run暖機30s/採樣60s，模式順序B/T/F/F/T/B，共12runs；先鎖定合法輸入route、camera/交戰/無雙/倒地事件及群眾五數coverage。若同phase workload不相容或自然結局太早，保存失敗，不補血/無敵/teleport，也不裁掉受影響幀；須先修路線並重審，不能重設E12舊budget。這12runs僅工具成本，不能代替正式三seed分級或180s成績；尚未批准/執行。

**成本允收提案（新方法界線，待批准，不替代原效能gate）**：每個可比較CPU/GPU p95與wall p99的正向增量同時≤0.5ms且≤5%；對照模式自身兩次重跑的同指標差異也須符合此雙界線，否則NOISE_UNRESOLVED。B/T僅評wall。F相對T增加PrivateBytes及dedicated VRAM各≤256MiB；穩態工具自身per-frame managed allocation=0（startup/payload flush另外列），全部工具結果仍須原效能與memory gate。各phase及完整run都評，任一必要比較缺值/變異/超限BLOCKED，不看結果後調大界線；跨其他seed/正式workload的成本代表性在正式E12跑前另review確認。

比較統計量：同population/phase以兩次較重模式指標的最大值減較輕模式兩次最小值，正向delta=`max(0,差)`，比例以較輕最小值為分母；分母0/未知保持BLOCKED。重跑noise以同mode的max−min及min分母評。memory的每run測量段完整1Hz有效槽取high-water，F兩次最大high-water減T兩次最小high-water（負差以0計），PrivateBytes/dedicated分開；全run及對齊phase皆比較。不能換成首尾平均掩蓋載入/工具buffer峰值，slot缺失或phase不唯一即BLOCKED。共有observer自身CPU/排程負擔在manifest如實列，不能以這份比較證明其零成本。

### M7：必要測試與可執行出口

| 群組 | 正例 | 負例與邊界 | 所需證據／目前狀態 |
|---|---|---|---|
| Counter | 唯一category/name/unit、可追溯source frame | UI Toolkit順序互換、duplicate exact、wrong unit、missing、LastValue重複讀 | Node/Edit＋catalog/trace；NOT_RUN |
| Pixel visible | opaque全露/局部露、同幀pose/cutaway | 全遮擋、視錐外、兩兵互遮、1pixel、另一camera、ID重用/死亡、alpha/MSAA不支援、readback error/overflow | Play/Player全解析度ID/depth raw及可見畫面；NOT_RUN |
| Window | 唯一HWND+PID/start、前後與事件一致 | 同PID另一HWND、失焦/最小化途中切換、rect0/resize、PID重用、事件漏/倒退 | pure fixtures＋可見Player切換trace；NOT_RUN |
| Timing | 唯一映射、不同arrival但同source、完整drain | reorder、duplicate conflict、zero/missing、frequency0、timestamp回退、warmup跨界、最後延遲/overflow/timeout、含wait錯作active | Node/Edit fixtures＋Player/同步Profiler trace；NOT_RUN |
| Memory | 全adapter唯一、精確100ns、完整1Hz槽 | duplicate/LUID變化、PID重用、DST invalid/ambiguous、100ns門檻越界、stale/future、錯type/overflow、invalid不降高水位、UTC跳變/missed槽 | 既有26離線case重用；新增fixtures/指定Player均NOT_RUN |
| Cost/workload | 三模式同版合法route、完整必要phase | 裁樣/補血/背景降載、噪聲/phase不匹配、positive增量或memory超限 | 12次成本probe提案，NOT_RUN；不是formal benchmark |

所有產品正/負/邊界tests、Unity compile/Edit/Play/build/Player及短CAPABILITY_PROBE由第2單元驗證；本次只交付方法文件。格式驗證/獨立advisory不表示上表能力通過。

### 下一單元精確範圍提案與授權門檻

以下為待人類批准的完整unit2 scope，不授權本次修改。相對repo根；新增檔只允許列名及同名`.meta`，沒有glob授權：

- 重用候選：`scripts/e12-probe.mjs`、`scripts/e12-gpu-telemetry.ps1`、`scripts/lib/e12-performance.mjs`、`scripts/lib/e12-process.mjs`、`scripts/tests/e12-performance.node.mjs`。
- Runtime：`unity/ChangshanLongdan/Assets/Character/Runtime/PerformanceProbe.cs`，及新增同目錄`PerformanceFrameLedger.cs`、`PerformanceWindowState.cs`、`PerformanceVisibilityFeature.cs`、`PerformanceVisibilityId.shader`。
- Config：`unity/ChangshanLongdan/Assets/Character/Runtime/Changshan.Character.asmdef`只加所需既有URP/Core reference；`unity/ChangshanLongdan/Assets/Foundation/Settings/FoundationRenderer.asset`只註冊預設inactive且僅probe顯式啟用的feature；`unity/ChangshanLongdan/Assets/Foundation/Editor/FoundationBuild.cs`只核對feature/flags/readback，不改品質/平台。
- Tests：既有`unity/ChangshanLongdan/Assets/Foundation/Tests/EditMode/PerformanceScopeEditTests.cs`；新增同EditMode目錄`PerformanceTelemetryEditTests.cs`及PlayMode目錄`PerformanceTelemetryPlayTests.cs`；既有`unity/ChangshanLongdan/Assets/Foundation/Tests/EditMode/Changshan.Foundation.EditTests.asmdef`、`unity/ChangshanLongdan/Assets/Foundation/Tests/PlayMode/Changshan.Foundation.PlayTests.asmdef`僅所需URP/Core references；fixture以測試runtime建構，不新增正式game場景/資產。
- 紀錄：`docs/engineering/UNITY_E12_CAPABILITY_PLAN.md`、`UNITY_E12_CAPABILITY_STEP_RECORD.md`（同docs/engineering目錄）、`openspec/changes/unity-migration-followup/tasks.md`；raw新run在`release/e12/`exclusive leaf，local-only。舊source由精確列檔採用，不整批cherry-pick或刪PR44配置。

Profile、thresholds、combat/AI/animation、正式素材、Web、Packages/Editor、Jev/全域配置、ACL、provider/時區設定及remote mutation均排除。若active來源需額外API/marker、material coverage不符或allowlist不夠，先交出精確scope修訂，不能擴寫其他模块。

unit2修復提案基於新counter/clock定位證據，原兩輪budget仍保持用完。人類需明確批准新unit2方法/檔案/測試與採樣額度（提案最多3次短probe：seed7/11/23、3s暖機+10s量測；成本probe上述12次；各run有界90s/成本run120s，launcher只終止自身handles）。失敗不得自動追加額度或重新計數；新定位如仍不可解除能力缺口即停止並保全。本次不申領或消耗這些額度。必要正式approval/merge/postmerge仍須依task1.4完成，才開始unit2；人類scope同意也不能替代該gate。

**目前出口**：task1.3方法草案已具體化，實際全部新能力仍BLOCKED/NOT_RUN。待獨立exact-candidate方案審查及人類對上述新scope的批准，才能勾task1.3；task1.4正式approval／merge授權／postmerge尚缺。沒有背景Player、美術製作或provider採樣。

### M2-T：既有透明特效的coverage擴充提案

`68d1522c1e8fb5852f67cc795636f89f0be207e4`已由獨立review接受為方法/已知阻礙checkpoint；此追加是同task1.3必要方法準備，不是新增runtime授權。鎖定E12候選實際來源：FeedbackView.cs SHA256 `28683ecbc880ce41c04796b26f14579ff1b5ab8f6f817c3b265468503c58dfe0`、ChangshanFeedback.shader SHA256 `443759b587c2421629c7d9c080ea03c3799d44bf1bc7f3599db1e1d55bb16635`。目前透明alpha模式與blend可定向重用，不能把任意透明shader當相同模型。

**待審語義**：visible取指定Game camera場景target中、至少1pixel有士兵surface通過實際opaque depth且在支持的透明blend後仍保留非零destination contribution；取UI/後處理之前的場景coverage。另存opaqueVisible與transparentSurvivingVisible、method版本，不把「非零contribution」叫人眼可辨識或最終畫面顏色差異。若正式規格所需是後處理/飽和後最終色彩或UI遮蔽的可辨識人數，此方法不等價，保持BLOCKED並另定義方法；不得默認採用較弱語義。只有review明確接受該camera pixel語義後才能把transparentSurvivingVisible寫入正式visible欄位，否則visible=null。

這裡是分析性非零blend係數，不主張排除有限精度/量化/飽和後可能為零的實際色彩影響。語義選擇須納入人類新scope批准及獨立審查，shader parity本身不能批准此語義；未齊備前visible=null、完整成本probe及formal E12保持BLOCKED。

對這份鎖定shader/材質的演算法提案：

1. 在主camera opaque完成的同幀快照，依M2建立scene ID/depth；模式5 fragment使用實際mesh/pose、Cull Off、ZWrite=true及opaque queue，作非士兵遮擋，不因shader tag Transparent而漏掉。所有未知shader/alpha clip/depth位移仍拒絕。
2. 全解析度coverage target初值1，與ID共用同幀opaque depth。遍歷實際透明renderer/submesh/material清單及mesh頂點色/UV/transform，使用相同ZTest/Cull與排序；只讀原renderers/material，不改原layer/queue/效果或幾何。覆蓋shader重現原模式0–4的fragment alpha/shape與clip行為，build manifest鎖原shader hash與每材質_Mode/_SrcBlend/_DstBlend/_ZWrite/renderQueue；runtime改property也逐幀readback，不僅啟動盤點。
3. [D3D11 blend因素](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/ne-d3d11-d3d11_blend)定義destination One保留背景、OneMinusSrcAlpha乘上1−alpha。既有spark/ring/pillar/trail使用destination One，不會完全抹除背後surface；dust用OneMinusSrcAlpha、無ZWrite。對finite alpha∈[0,1]，只在實際通過depth的dust fragment alpha=1時清coverage，其餘保留；這是非零destination contribution的布林判斷，不累乘到浮點underflow、不設新的可見度epsilon。未知blend/alpha不合法/transparent ZWrite=true/sort依賴未知則BLOCKED，不能硬clamp或當透明不遮擋。
4. 提案coverage shader輸出0以最小值blend寫遮擋，其他fragment保留1；覆蓋target須支持該format/blend，否則BLOCKED。以ID及coverage同request group讀回；每個soldier ID至少1pixel coverage=1才計數。若某pixel已有完全opaque dust遮擋，後續additive不恢復士兵contribution。ID與coverage任一讀回失敗、尺寸/幀/roster不一致均null，不單取成功結果。
5. 不修改原Feedback shader以降低耦合；新增measurement shader必須對原每mode alpha公式做GPU parity fixtures，source hash/property不符即拒絕。透明draw成本與同幀mesh快照成本納入F。第一版只允許上述已核對模式，場景其他透明材質（如城池/旗幟/材質變動）須完整盤點；未列可支持來源或shader variant不進成本/正式跑。

**buffer修訂提案**：透明版每槽保留ID+coverage group，最多8組in-flight（取代opaque第一版16組），drain仍最多16呈現幀或2s；GPU/CPU實際buffer bytes、格式及allocator overhead全readback。8組不是已證明足夠的latency，overflow即BLOCKED，不丟request/降解析度。原成本Private/VRAM各256MiB增量提案不放寬。

新增必測fixtures：dust alpha0/0.5/1、全遮/局部1pixel、兩層半透明不得因累乘underflow誤遮、前後depth、opaque fragment遮擋、各additive mode不抹除背景、alpha形狀空洞、Cull雙面、材質屬性途中變動、未知shader/variant/blend、ID/coverage不同幀/失敗、camera/LOD/pose/cutaway一致及buffer8→9邊界。GPU alpha/coverage與原shader的相同mesh/pixel結果精確比較，無法建立同源parity就保持BLOCKED；自然遊玩與S06可讀性仍另驗收。

**精確scope追加（待批准）**：只在既有unit2 allowlist另加`unity/ChangshanLongdan/Assets/Character/Runtime/PerformanceVisibilityCoverage.shader`及其同名`.meta`；Runtime Feature與既有PerformanceTelemetry Edit/Play tests承接supported-material map/coverage/parity fixtures，沒有新增FeedbackView/Feedback shader修改權。此追加不增加3次短probe/12次成本probe提案額度；先fixture及實際supported-material完整盤點/幀映射全部通過，才可啟動成本probe。新方法仍未編譯/render/Player驗證，尚未正式接受visible語義或取得unit2人類scope批准。
