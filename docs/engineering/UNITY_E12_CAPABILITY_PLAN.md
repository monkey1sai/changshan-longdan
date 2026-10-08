# Unity E12 能力恢復：定位證據與方案

2026-10-08（Asia/Taipei）；第一個 eligible 單元 U1，對應 OpenSpec tasks1.1–1.3。規格審查版本 `6c5282bf752e71dd54e69de14819f32b74d0dd5c`；當次使用者指示「你審查spec, 通過之後開始spec」支持本機執行準備，不自動授權push／PR／merge／provider／美術傳送。原E12兩輪修正預算保持用完，本次未修量測器。

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
