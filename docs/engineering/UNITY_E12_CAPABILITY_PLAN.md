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
