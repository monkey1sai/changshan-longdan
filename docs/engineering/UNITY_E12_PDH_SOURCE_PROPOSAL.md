# E12 PDH-only 來源提案（2026-10-12）

狀態：離線方法準備；live scope **NOT_AUTHORIZED**。基準 `9f1ffdc140618cac2316afce8e3709dfb54768de`；使用者對SPEC v2交付回答「同意」，本輪只續做2.1的定位與方案，不解讀為新實測額度。SPEC仍4/22（18.2%），task2.1、正式VRAM、E12／E13未完成。搭配 [SPEC v2決策](UNITY_SPEC_V2_DECISION_RECORD.md)、[PLAN](UNITY_E12_CAPABILITY_PLAN.md) 與 [STEP_RECORD](UNITY_E12_CAPABILITY_STEP_RECORD.md)。

## 已有證據與可成立的結論

本輪唯讀核對既有run `0eb402bf-eca8-461b-a300-7c04d6f124ca`，source `2329b486c6dd1942acab4d415792e51a5aa45d25`。原始資料位於 `C:\Repos\changshan-longdan\.worktrees\unity-e12-capability-validate\release\e12\player-clock-owned-v2`（local_only）：

| 檔案 | SHA-256 | 原結果 |
| --- | --- | --- |
| result.json | 4e318aa839a0a67ff483ec34ee95577d4630b4a95659149a0de6614704c0f72d | BLOCKED_PLAYER_CLOCK；attempted1／accepted0，cleanupConfirmed=true |
| window-1.json | 93c471538525accdadfd7b3bbb4f1e60c4dc9d9b99357aea53bcabd8ed4677e4 | WMI elapsed2098.2696ms，pdhSequences=0，completeCollection=false |
| window-1.json.wmi.json | 6f5948e9c2c8ace5a1d54009378b62828e69863fbe2adf493fc06ef706a98987 | WMI失敗checkpoint；不是有效樣本 |

VERIFIED：`Capture-E12PlayerClockWindow.ps1` 先依WMI取得instance集合，再對各instance呼叫PDH；逾時發生在前者。INFERRED：獨立PDH枚舉可移除這個CIM呼叫依賴，值得先設計離線驗證。UNKNOWN：PDH是否也逾時、底層provider是否相同、實際時鐘映射與memory語義。不能說已找到CIM根因、修復時鐘或證明PDH可用。原result的sourceUnchanged／payloadUnchanged=null保持原樣。

## 資源選擇與官方依據

| 選項 | 已查能力 | 本輪決定 |
| --- | --- | --- |
| 現有PDH P/Invoke＋原validators | `Capture-E12ClockComparison.ps1` Native.Read；`e12-clock-contract.mjs`；`gpuInstances`／`validateGpuSeries` | Extend解析／拒絕規則，另提PDH-only契約；不整批套用WMI schema |
| PDH英文counter及顯式wildcard展開 | language-neutral入口與本地化→展開→個別加入流程 | 優先候選；全集／時鐘仍待證 |
| PDH wildcard raw array | 官方支援wildcard陣列 | 本輪不建第二實作；顯式展開較易逐counter核metadata，不表示array不適用 |
| DXGI QueryVideoMemoryInfo | 呼叫程序自身的segment budget／usage | 不採外部helper查Player；移入Player需新整合，LOCAL CurrentUsage也未證原三欄等價 |
| 原WMI重跑、猜GUID／固定減8h | 原額度已耗盡 | 不採用，不新增registry／provider／driver掃描 |

官方來源（本輪已讀；不是本機provider實證）：

- [PdhAddEnglishCounterW](https://learn.microsoft.com/en-us/windows/win32/api/pdh/nf-pdh-pdhaddenglishcounterw)：英文入口不自動展開wildcard；須GetCounterInfo取得localized path，再Expand及AddCounter。Add成功不證instance存在。
- [PdhGetCounterInfoW](https://learn.microsoft.com/en-us/windows/win32/api/pdh/nf-pdh-pdhgetcounterinfow)、[PdhExpandWildCardPathW](https://learn.microsoft.com/en-us/windows/win32/api/pdh/nf-pdh-pdhexpandwildcardpathw)：可size query再一次data read；buffer單位前者bytes、後者TCHARs。
- [PdhGetRawCounterValue](https://learn.microsoft.com/en-us/windows/win32/api/pdh/nf-pdh-pdhgetrawcountervalue)、[PDH_RAW_COUNTER](https://learn.microsoft.com/en-us/windows/win32/api/pdh/ns-pdh-pdh_raw_counter)：分查API status及CStatus；raw TimeStamp為local time FILETIME，不直接假定UTC。
- [PdhCollectQueryDataWithTime](https://learn.microsoft.com/en-us/windows/win32/api/pdh/nf-pdh-pdhcollectquerydatawithtime)：只描述第一個counter取值時間，不能代替各raw時間或producer最後更新時間。
- [QueryVideoMemoryInfo](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_4/nf-dxgi1_4-idxgiadapter3-queryvideomemoryinfo)、[DXGI_QUERY_VIDEO_MEMORY_INFO](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_4/ns-dxgi1_4-dxgi_query_video_memory_info)：自身usage／budget與segment選擇；沒有指定另一PID的參數。

## PDH-only clock候選契約

此候選先驗clock／集合，不分析或持久化usage，不直接提供正式VRAM；未來native raw API會回傳包含value的結構，須丟棄usage欄位，不宣稱API從未取得該欄位。固定本機英文path `\GPU Process Memory(pid_<TargetPid>_*)\Dedicated Usage`；TargetPid須正整數且綁自有Player的runId／processStart／image／full-build。拒絕遠端machine、任意counter／path輸入及非目標PID。不得用`pid_12`前綴誤收`pid_123`。

1. 保存前置Player身分，開一query、加一英文wildcard counter。依官方流程取得本地化完整path，展開全部匹配項；移除wildcard handle，個別加入counter。
2. GetCounterInfo與Expand各限size query一次＋data read一次，不resize/retry。metadata每份上限64KiB，path list上限32768 UTF-16 code units；大小改變／超限／截斷／未終止／指標越界即拒絕。這是新解析上限，不挪用舊registration額度。每counter核對完整path／type，不只看exit0。
3. 嚴格解析 `pid_<pid>_luid_0x<hex>_0x<hex>_phys_<n>`；拒絕空集合、超過16項、parent／#index／未知suffix、重複名稱、不同文字映射同LUID／phys。保存原始全集及canonical集合，不截前16項。localized object／counter須與固定英文handle回讀項目一致，不猜中文名稱。
4. 同query collect一次，每counter raw一次，保存API status、CStatus、type、raw timestamp及UTC／monotonic query bracket。CStatus只接受0或1、原type要求65792；type符合仍不證bytes。CollectWithTime不代producer clock，也不以穩定usage判stale。
5. 再展開一次集合（size／data各一次），核對前後集合及Player身分一致；集合變動、缺counter或NO_INSTANCE拒絕。兩端集合相同只支持bracket核對，不宣稱期間絕無瞬間變動；若要求更強snapshot保證，先解決而非填complete=true。
6. 依受審時區／DST來源解碼每counter raw時間，維持lag≤2s、future≤250ms、query≤2s、UTC／monotonic duration差≤250ms及逐instance有效高水位。未知／DST歧義／倒退／重複／時區變動拒絕，不固定減8h，不以collector UTC填缺值；失敗不推高水位。
7. 每來源呼叫及整個枚舉／collect／讀取窗口受原2s deadline；晚回先保存再判失敗，不當即時取消保證。finally關閉自有handle，失敗不續下一來源或窗口，cleanup完成須另證明。

候選API上限按N個instance計：OpenQuery1、AddEnglish1、wildcard GetCounterInfo2、前Expand2、RemoveCounter1、AddCounter N、各GetCounterInfo 2N、Collect1、GetRaw N、後Expand2、CloseQuery1，共 **11+4N≤75** 次。失敗後僅允許自有cleanup，仍計入上限。尚未授權任何一次呼叫；身分、時區、環境fingerprint及controller讀取不藏在75次內，須另列精確來源與新預算。本提案沒有可直接執行的live command。

## 與舊PLAN的取代及保留關係

| 舊方法 | 候選改動 | 保留／缺口 |
| --- | --- | --- |
| A1來源／WMI bridge定位 | 提出PDH官方語義與本地化全集方法 | loaded producer／memory unit仍UNKNOWN，不稱正式VRAM出口通過 |
| A2先WMI後PDH雙來源clock | 後續受審及新授權後另建PDH-only schema，移除WMI成功前置 | 不改舊失敗、不冒充雙來源parity；另審來源足夠性 |
| A3 dedicated／shared／committed | 此提案只處理Dedicated counter clock，不接usage | 三欄counter名稱、bytes／type、聚合、整數精度／對齊仍須另證，不輸出formalVRAM |
| A4–A7、B、C、D | 不變；按SPEC v2條件式資產／人工executor | visible／timing／成本／品質／正式E12／完整E13及review／merge gates不變 |
| 舊三窗口批次 | 不續用，不將75calls當舊80calls剩餘 | 新live scope=0；fingerprint／五階段／controller未提出可執行額度 |

## 純資料離線契約實作（2026-10-12）

使用者「Follow up」後，獨立開始前範圍審查接受四檔：本提案、STEP_RECORD、新module及tests。已建立 `validatePdhSourceSeries(windows, expected)`，只檢查JSON形狀的資料自洽性；無檔案I/O、子程序、DLL或provider呼叫，不接現有正式validator。缺模組baseline曾以ERR_MODULE_NOT_FOUND失敗；實作後驗證及exact-candidate結果見STEP_RECORD與本機review紀錄，不以本段預填正式批准。

輸入schemaVersion=1：expected綁PID／processStartUtc／imageSha256／runId／fullBuildSha256／fingerprintSha256／timezoneId／utcOffsetTicks；每窗包含before／after、整窗query、localized object／counter、normalized trace與checkpointSaved。trace status使用SUCCESS／MORE_DATA／ERROR，屬純資料協定，未實作native回傳碼映射。size-query MORE_DATA是正常協定步驟，data再次MORE_DATA則拒絕。Info buffer以bytes與字串offset／終止描述，Expand buffer以UTF-16 code units／MULTI_SZ描述；均非真實ABI或pointer解參照證明。Expand項目的handle是wildcard來源關聯標記，不代表再次操作已Remove的native counter；其實際API依path查詢，native接線尚未實作。

輸入先做有界、無accessor呼叫的資料快照，拒絕循環／共享物件參照、不安全數值、超深／超大資料。時間使用既有utcTicks／BigInt及extendClockTimeline；整窗、各API、跨窗timeline與高水位均核對，整窗自洽後才提交狀態。輸出OFFLINE_CONTRACT_ACCEPTED僅指資料協定符合，或BLOCKED_PDH_CONTRACT及原因／有效前綴／failedIndex；固定executionVerified=false、formalVram=false，不產正式clock mapping PASS。前後集合、localization／DST／fingerprint／saved／cleanup仍是caller claims。

第一輪draft獨立審查用純fixture重現程序出生前樣本與超DWORD PID的false acceptance；已補sample timestamp≥processStart、PID範圍1..4294967295，並驗證等於邊界、超界／早100ns與拒絕時不推高水位。這是新離線契約的身分防護，不修改舊validator、freshness／效能數值或已用live預算。新targeted42/42 PASS；最終必要回歸與exact-SHA結果見STEP_RECORD及本機review紀錄。

## 原最小實作範圍與驗證矩陣

建議先新增純資料契約 `scripts/lib/e12-pdh-source-contract.mjs`、`scripts/tests/e12-pdh-source-contract.node.mjs`，另更新本提案與STEP_RECORD。重用`utcTicks`與clock測試模式；不改正式validator放行、不建native helper、不載DLL、不呼叫Get-Process／CIM／PDH、不改Unity／profile／資產。此為待審實作allowlist，不是本次新增完成項目。

| 類別 | 必要離線案例 | 可證明範圍 |
| --- | --- | --- |
| 正例 | mock英文→localized→兩adapter全集、CStatus0/1、跨窗時間遞增但數值不變 | 僅契約與拒絕邏輯，不證來源 |
| 身分／集合負例 | PID前綴碰撞／重用、錯run／image、空集合、17項、重複canonical、#index／parent、集合變動、counter消失 | 不輸出有效集合，不截斷 |
| API／metadata負例 | add成功但NO_INSTANCE、錯type／path、unknown unit、每階段status失敗、缺bracket／timestamp | 缺usage等價證據仍formalVRAM=false，mock不創造unit證據 |
| buffer／計數邊界 | bytes／UTF16混用、cap前後、size0／data大小變動、MULTI_SZ未終止、越界指標、超過11+4N | 拒絕不完整資料／隱含重試；trace不是native ABI證明 |
| 時鐘邊界 | lag2s／+100ns、future250ms／+100ns、query2s／+100ns、duration差250ms／+100ns、DST歧義／無效、倒退／重複、失敗不推高水位 | 100ns算術不經Number丟精度，保留原門檻 |
| fail-stop | 首錯後只有cleanup、close失敗、保存失敗 | 不偽造cleanup或checkpoint成功，無live回退CIM |

離線實作須先scope review、最小失敗baseline、正負邊界測試、scoped commit及exact-SHA終審；連續兩輪修正未通過則停止並交付證據。只有離線契約通過後才提native ABI／mock接線與新實測包絡；屆時須列每個helper／fingerprint／Player／五階段的操作、次數、總deadline及失敗停止條件，明確授權後才能執行。

## 當前退出

本輪交付純資料離線契約及測試，正式批准與後續native接線仍未完成。PDH clock映射、全集完整性、deadline可行性及三memory欄位等價性仍UNKNOWN；不勾2.1，不進正式E12／E13。無新實測額度、背景Player、push／merge／deploy或新付費服務。回復使用本機checkpoint普通revert，保留歷史raw。
