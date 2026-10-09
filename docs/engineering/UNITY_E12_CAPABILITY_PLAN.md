# Unity E12 能力恢復：定位證據與方案

## 目前執行順序（2026-10-09；以此段及最新 STEP_RECORD 為準）

2026-10-10 fresh fingerprint已執行一次：source `bdd3e0e30a0b066c1d8809156eedcbb73901a041`、run `4d3853c5-5778-4387-b93e-15bd963ef3d1`，四來源306.38／119.7516／83.5295／25.3616ms，controller916.0004ms／exit0／sourceUnchanged=true；狀態PASS_ENVIRONMENT_FINGERPRINT_ONLY。OS10.0.26100、RTX4060Ti driver32.0.15.8097、固定API檔hash與Taipei Standard Time（BaseUtcOffset+8h／SupportsDST=false／rules空／Stopwatch10MHz）均保存。producer implementation／loaded module仍UNKNOWN，clock UNVERIFIED，沒有counter／Player／新窗口。本批完整read額度已使用，不重跑。下一eligible為指定Player controller／READY的具體scope審查，再新同SHA Unity五階段與fullpayload，不能直接使用舊Player。完整索引見STEP_RECORD。

2026-10-10 方法修訂已獨立接受並開始實作：使用者「請執行」續行本SPEC。`/root/unity_spec_review`接受clock-only改以版本化公開API契約、fresh環境fingerprint、同一自有Player及原生UTC/monotonic參照檢驗預先固定local-encoded假設。producer implementation／loaded module保留UNKNOWN，不再是clock-only先決條件；不改正式counter單位與來源門檻，不宣稱通用WMI／VRAM。以下「待審／未決」段落保留歷史，這一段優先。

本輪範圍為新獨立 `Capture-E12ClockFingerprint.ps1`、純 `e12-clock-contract.mjs`、必要fixtures及本PLAN／STEP_RECORD（V10/V12、S05診斷）。fingerprint新方法只有一次四來源：CIM OS一次、GPU全列表一次、固定三API檔版本/hash一組、timezone ID/BaseUtcOffset/SupportsDST/完整可用AdjustmentRules與Stopwatch frequency一組；每來源含解析≤2s，外controller≤20s，逐來源CreateNew保存，任何缺值／錯誤／超時即停，不重試。這不是重跑metadata-v1/v2，不讀schema／registry／counter，不啟動Player。fingerprint只識別環境與磁碟API檔，不能證明loaded producer。先離線production-loop stub與exact-source/controller審查，再執行fresh `release/e12/clock-fingerprint-v1`；未滿足前不呼叫真來源。

純window validator保留100ns、身分、完整集合、query≤2s、lag≤2s、future≤250ms、UTC/monotonic duration一致≤250ms及每來源高水位；raw FILETIME／宣告offset／UTC結果必須數值一致，PDH CStatus有效0或1。DST與offset的權威、原生UTC讀取、完整集合與環境未變須由後續controller驗證，flag不能代替來源證據。fixture成功不產mapping PASS。後續Player controller／READY需獨立scope、新同SHA五階段及fullpayload／精確候選審查，沿用一次最多3窗口，不增加額度。A1及正式E12仍未完成，SPEC4/22（18.2%）。

2026-10-10 最新inventory結果：source `bbc0f6df9cecf5337a0a968cca7f366ae6d3d77f`、run `6cb4854c-2e01-402a-b942-ef06f247a0a8`，唯一API成功回176個V2 counterset GUID，無empty／duplicate，原序保存；舊GUID不在當次集合。來源19.975ms/native6.689ms/controller547.7504ms／exit2/sourceUnchanged=true，未超時。狀態V2_COUNTERSET_INVENTORY_OBSERVED_CLOCK_BLOCKED，沒有查名稱/provider/instances或Player，window0/3。這只接受當次V2 inventory，不判GPUcounter不存在或舊GUID是provider，不解除A1。單次1call已用完，不新增176名稱掃描／補查／重跑；下一個方法候選見下段，沒有可直接執行的新採樣。證據索引見STEP_RECORD。

2026-10-10 使用者明確「開始 SPEC 及同意授權續行」。本輪獨立方法審查縮限新方法為一次V2 inventory：允許新增 `scripts/diagnostics/Capture-E12CounterSetInventory.ps1`、延伸 `scripts/tests/e12-performance.node.mjs`，及更新本PLAN／STEP_RECORD；V10/V12、S05診斷，不改runtime/assets/spec tasks或門檻。採獨立advanced script入口，拒絕舊flags與多餘參數；一次 `PerfEnumerateCounterSet(null, fixed512GUID,512,out count)`，max1call，沒有sizeprobe/resize/retry/request9/request8/CIM/registry/PDH/instances/Player。成功count合法0..512，只解析前count筆且非empty／無重複，保留原序；error8僅requiredCount，其他error的count/array=null。來源含解碼2s、外controller20s；同步API不宣稱2s即時取消；逐步CreateNew保存。先雙runtime離線fixtures與exact-source review，再執行一次fresh `release/e12/counterset-inventory-v1`。此為新方法獨立1call，不挪用registration-v1第二call、不重設任何舊額度；Player0/3、SPEC4/22。結果只為當次V2集合，不能證明名稱、provider或clock；舊GUID有／無均不得自動衍生重查或全域名稱掃描。[API契約](https://learn.microsoft.com/en-us/windows/win32/api/perflib/nf-perflib-perfenumeratecounterset)、[V2 consumer流程](https://learn.microsoft.com/en-us/windows/win32/perfctrs/using-the-perflib-functions-to-consume-counter-data)。

來源證據替代方法準備（文件候選，未放行）：獨立審查核對正式design/spec只要求counter category/name/unit、timestamp/UTC、Player identity、freshness及高水位，沒有明訂producer DLL/loaded-module證明。後續PLAN的implementation/version gate不能執行時靜默略過；可先提出以官方API契約與同Player時鐘證據滿足原spec的明確修訂。`PdhGetCounterInfoW`提供path/type，不提供counterSetGUID，CVersion未使用，不當provider版本；type不單獨證明bytes單位。PDH raw timestamp為local FILETIME，但API status與CStatus分別核對。候選須綁PID/start/image/全adapter/instance、原生UTC/monotonic參照、WMI與PDH各query window、DST拒絕／rawtimestamp／完整allowlist與環境失效條件；兩來源可能共用底層，相符不當獨立真值，collection time也不能當producer last-update。未知implementation維持UNKNOWN，必須說明它為何不影響限定環境結論並獨立審查；目前A1/A2 gate保持，不啟動替代採樣或重跑已用批次，inventory非此方法必然前置。[counter info](https://learn.microsoft.com/en-us/windows/win32/api/pdh/ns-pdh-pdh_counter_info_w)、[raw timestamp](https://learn.microsoft.com/en-us/windows/win32/api/pdh/ns-pdh-pdh_raw_counter)。

### 下一個clock-only方法：待審的具體出口

1. 原SPEC2.1的正式counter單位／sample timestamp新鮮度不得由clock-only代替。既有schema的DedicatedUsage只有UInt64／CounterType65792／DefaultScale0／英文名，沒有Units；該schema本身仍是v2晚回資料，不提升當次metadata PASS。PDH raw API必要接收FirstValue/SecondValue，但clock-only不持久化／輸出／分析DedicatedUsage值，也不讓值參與判定，只驗原始timestamp/frequency與PDH counter API/CStatus/type。即使成功也只完成指定環境時鐘子gate，正式VRAM單位與值來源仍另驗。
2. 提議修訂既有A1方法gate：producer implementation與loaded-module資訊保留UNKNOWN，可用「有版本的公開counter API契約＋同一自有Player身分及原生UTC/monotonic參照」形成限定時計結論；不是用OS版本冒充producer版本。此提議在方法獨立審查明確接受前不生效；A1仍BLOCKED，舊metadata/registration/inventory不重跑，不自動開始Player或下一單元。
3. 下一實作scope先限純資料validator／fixtures與診斷script/controller，沿用b361d76的一次最多3窗口，沒有新增窗口或memory/probe額度。先定義必要環境fingerprint及每項來源read/次數，不能在程式內隱含補查CIM class／registry／provider；尚未列清的metadata為阻擋項，而非自動挪用舊批次。
4. Player前必須新的同SHA compile/Edit/Play/build/Player五階段、完整payload清單hash、無他人lock及精確script/controller review；clock-only Player另以自有PID/start/image/runId及readback綁定。READY來源與deadline需先實作且測試，不能以任意其他process或舊Player代替。
5. 每窗口保存該Player全adapter/instance集合；WMI查詢前後PID/start/image、各instance同名PDH、API status與CStatus分列、所有來源的UTC FILETIME與monotonic窗口、frequency及timezone/rules/offset。不得first-instance取代全集；任何重複、缺漏、集合變化、PID重用、clock/source未知或query>2s即保全停止，不補第4窗；整run90s。
6. 事先固定local FILETIME轉換，DST ambiguous/invalid拒絕；100ns整數計算，lag≤2s／future≤250ms／query≤2s／高水位／UTC倒退與monotonic一致全部保留。WMI/PDH共源相關不當獨立真值，原生UTC才是外部時鐘參照；必須明確區分collection timestamp與GPU值最後更新，後者UNKNOWN只限制該主張，不新增成原spec gate，也不因數值穩定而判樣本過期。不得依最靠近query結果挑時區／offset。
7. 純fixtures先驗來源API/CStatus、完整集合／身分、時間／頻率、DST／時區變動、exact邊界、重複倒退／缺樣、值欄位不得外洩及失敗保存。僅當三窗口所有必要來源同時通過且獨立結果審查接受，才產出綁run/code/fullpayload/環境的有限clock證據；OS/driver/API binary/timezone/rules/build變動或未知都使結果失效，不產通用／永久VALIDATED。
8. 目前未決的實作前證據：fresh環境fingerprint的最小read清單與預算、WMI原始時鐘相對PDH local FILETIME的可接受證據、各timestamp實際記錄的時點與sample freshness門檻的對應。以上任何未解不能以inventory成功或方案文件通過消除。若方法不能滿足原spec，保存阻礙，不偷偷降低門檻。

| 欄位 | 官方語義 | 既有raw觀察 | 允許主張 | 尚缺證據 |
|---|---|---|---|---|
| WMI Timestamp_Sys100NS / Frequency_Sys100NS | [base class](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-perfrawdata)只定100ns及10000000Hz，不定此GPU class的local編碼 | 3舊窗frequency10000000；固定當時Taipei+480解碼均在允收範圍，直接UTC均超前約8h | 支持該舊來源的local-encoded假設 | 指定Player／完整集合／fresh版本與限定方法驗證，不能變通用WMI契約 |
| PDH_RAW_COUNTER.TimeStamp | [官方](https://learn.microsoft.com/en-us/windows/win32/api/pdh/ns-pdh-pdh_raw_counter)為資料收集的local FILETIME，CStatus另檢 | API/CStatus皆0，type65792；固定offset解碼皆在原門檻，兩筆略早於call start | 有契約的collection clock；不能要求嚴格落在call內 | 同Player與每instance query/clock／timezone規則，不能推出bytes或值最後變動 |
| native UTC FILETIME | [官方](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getsystemtimepreciseasfiletime)回UTC | 舊raw包住各WMI/PDH來源 | 獨立UTC參照，供lag/future判讀 | 舊run無monotonic mapping/版本；新方法須補、不能回填歷史 |
| query start/end、PID/adapter | query窗口是caller觀察；instance名只為來源識別 | 舊run固定pid31848單instance；六來源皆≤2s | 非Player定位證據，原門檻可重算 | 自有Player PID/start/image/runId/fullpayload、全adapter及前後一致性 |

既有raw離線重播（沒有新query）：來源仍在 `C:/Repos/changshan-longdan/.worktrees/spec-unity-migration-followup/release/unity-followup-u1/`，raw SHA `8c3659674b4fad1b48e8e85041b513c3b84742f7cae9f3322138a53a93c29c36`、舊analysis SHA `3376ec95502b3edf517cb4020e3fd521e7a5a6e28990e36948b3972d04a30252`均相符。按當時明確offset480，以BigInt FILETIME重算六來源duration／lag／高水位，與舊analysis完全一致；六local解碼在原允收窗、六directUTC在窗外。新 `release/e12/counterset-inventory-v1/legacy-clock-replay.json` SHA `3791aa1a4831e39a2aa1dbe5aaf3175feb3b3ac08a278ad80f0d819e5cabebdf`。這只驗歷史運算與假設相容，不是重新採樣、環境版本或Player PASS。

最小fresh fingerprint read清單候選（NOT_RUN／待方法與額度審查）：CIM OS Version/BuildNumber一次、GPU Name/DriverVersion/PNPDeviceID全列表一次；固定System32/pdh.dll、wbem/WmiPerfInst.dll、drivers/dxgkrnl.sys的version/hash一群組；timezone ID/AdjustmentRules與clock frequency一次本機讀回；同版Player已存在readback作graphics/API/engine/fullpayload綁定。以上分別證環境/API檔案版本而非producerimplementation，不讀registry或重跑CIM class，不擴大名稱掃描；需決定哪些為必要且足夠、各來源2s/總20s與一次性read額度，再受審才能執行，不能套舊metadata的未用項。方法確認後只補兩個有辨識力fixtures：值不變但timestamp新鮮仍有效、WMI/PDH相符但在UTC允收窗外必拒絕；先前DST/100ns/邊界tests沿用，不以大量合成fixtures代替來源證據。

2026-10-10 最新實際結果：已執行一次 registration-v1，source `343b433daf2dfd72ff660650e643778d38aead85`、run `618be81c-ae82-48a4-affa-22b6503cbc0a`。第一個 request9 回傳4200，未取得英文名稱，第二個 request8 NOT_RUN；BLOCKED_REGISTRATION，provider/producer/clock 未證明。此批即停止，不能將未執行的第二call改為猜GUID、重試或其他查詢。來源含解碼23.8519ms、native6.426ms、controller662.9141ms／exit2；未超時不代表來源綁定或clock通過。Player未啟動，窗口仍0/3。A1仍BLOCKED，以下方法準備段保留歷史時序；原v2不重跑。證據與hash見最新STEP_RECORD。

2026-10-10 來源定位方法續行：使用者「同意」承接上一則指定counter registration方法。獨立實作前審查接受一次最多兩次本機 `PerfQueryCounterSetRegistrationInfo`，不重跑CIM metadata。新增明確 `-CounterSetRegistrationOnly`，與 `-PlayerMetadataOnly` 互斥，在任何native呼叫前核對已保存v2第三step SHA256 `474e781f8430d234e007ee69dacc5f7dedb67adad5d5508f46a1ddd116553a00`及固定RegistryKey GUID。該GUID僅counterSetId假設；先request9/lang0/local-null、固定4096byte，成功且嚴格UTF16LE名稱完全等於GPU Process Memory，才request8/lang0、固定16byte且非Empty GUID。每來源包含呼叫與解碼的實際時間≤2s，外controller總20s；同步API不宣稱2s即時取消。一次fresh `release/e12/counter-registration-v1`，逐call先CreateNew raw再判是否續行；任何錯誤/超時即停，不sizeprobe/resize/retry。成功的actualSize才是有效資料長度；錯誤8只存requiredSize，其他錯誤兩size及bytes均null。最多2次registration calls是此新方法的單獨上限，不消耗或增加Player時鐘0/3窗口、不重設任何舊額度；沒有CIM/registry/PDH instance/Player/remote/付費。兩call成功也只為REGISTERED_COUNTERSET_PROVIDER_OBSERVED_CLOCK_BLOCKED，implementation/version/clock仍未證明。先完成離線ABI/decoder/順序與fail-stop fixtures及exact-SHA審查，再執行；不是完整A1出口或SPEC完成。

使用 change：`unity-migration-followup`（spec-driven）。正式完成度只讀 tasks.md：4/22（18.2%）；本表將剩餘任務拆成可執行動作，不新增完成率或改變驗收條件。下方歷史「待批准／NOT_RUN」須連同各段日期、版本及最新紀錄閱讀，不能當目前狀態。每步由主控實作／保存證據、獨立 reviewer 審精確候選；美術製作歸工程師、視覺／感官確認歸使用者。可獨立的準備在既有scope內續作，不能以準備完成跨越受阻gate。

| 步驟 | 對應SPEC／前置 | 執行動作 | 驗證與可交付出口 | 現況／停止條件 |
|---|---|---|---|---|
| A1 環境及來源前置 | 2.1；v2 deadline失敗、registration-v1已執行 | 保存兩方法的raw及停止證據；僅分析既有資料與官方方法，先提出下一個來源身分定位方案 | source/producer/version/clock須有可核對綁定；新方法先審scope、calls與deadline，不重設舊額度 | BLOCKED：registration request9回4200，request8未執行；本批停止，不猜GUID／重跑，不能進A2 |
| A2 指定Player時鐘 | 2.1；A1必要來源綁定已證明，精確script審查及新同版五階段通過 | 凍結code/fullpayload，自有可見Player、固定argv，最多3窗口、整run90s；不得以其他process代替 | 全adapter集合／PID-start-image／WMI-PDH原生clock／UTC-monotonic窗口；固定解碼及freshness負例，全部來源同時通過及獨立審查 | NOT_RUN；未知binding不得啟動；失敗窗口算一次，不補第4窗 |
| A3 counter與記憶體來源 | 2.1；A2通過且在已批准allowlist | 接入受證據綁定的clock contract、counter category/name/unit與Player identity，保留null及高水位 | 正常、錯counter/unit、stale/future、PID重用、倒退／重複／缺樣；工具tests及同版Unity驗證 | NOT_RUN；禁止只改VALIDATED標記或降門檻 |
| A4 前景與真正可見數 | 2.2；已審M2/M2-T範圍 | foreground/focus/minimized、alive/engaged/attackers/frustum/visible分列；指定camera同幀ID/depth/透明coverage | 遮擋、畫面外、其他camera、失焦及透明材質parity；完整材質盤點，unsupported拒絕 | NOT_RUN；未知shader/幀映射維持visible=null，不新增資產或修改原效果 |
| A5 timing與逐幀接線 | 2.3；純ledger已驗，但runtime未接 | 接CPU/GPU delayed frame identity、latency/去重/收尾及1Hz記憶體對齊，保存原始缺口 | 缺樣／重複／不連續／warmup邊界／最終延遲樣本；不跨失敗列補接 | NOT_RUN；錯幀或缺來源不出正式summary |
| A6 能力與成本驗證 | 2.4；A3–A5 fixtures完整及候選審查通過 | Node/Web相容、Unity compile/Edit/Play/build/Player，凍結完整包後執行已批准三seed短probe及B/T/F成本對照 | 同SHA raw/readback、完整包前後一致、量測成本；短probe僅CAPABILITY_PROBE | NOT_RUN；保留原3短probe／12成本probe額度，不挪用或追加 |
| A7 能力單元退出 | 2.5；A3–A6必要證據齊 | 精確候選正式獨立review；具體授權PR/merge後核CI及postmerge | 工具能力與版本相容證據完整才勾2.x | NOT_RUN；advisory、commit或CI不能替代正式gate；不自動push/merge |
| B1 美術交付 | 3.1–3.2；核對工程師/來源/packet/傳輸授權 | 核實需求送達與接單；接收新delivery_id/GLB/來源hash及QA，保留舊資產 | 實際送達/交付證據，material count由GLB盤點 | PREPARED_NOT_SENT；無送達不稱製作中；不接管資產製作 |
| B2 Unity整合品質 | 3.3–3.5；B1有效交付 | 核21骨/4influences/17招/tip/FootPlant/root/fallback；同版雙引擎render及自然操作 | S01/S03/S07、S02/S06/S08；30/60/120Hz原門檻；使用者視覺、正式review/授權merge/postmerge | NOT_RUN；衣角例外只限既有code/GLB/截圖，不延伸新版本 |
| C1 正式效能基線 | 4.1；A7及B2完成 | 鎖code/profile/asset/fullpayload、硬體driver/readback、合法workload/峰值、成本與跑前budget | 必要來源、品質與版本同時齊備且review通過 | NOT_RUN；任何必要UNKNOWN禁止正式benchmark |
| C2 分級與長測 | 4.2–4.5；C1通過 | 20→50→100→200→300，每級seed7/11/23各30s暖機＋180s；再30min soak/回歸 | 原wall/CPU/GPU/draw/GC/RAM/VRAM、drift/slope；正式review/授權merge/CI/postmerge | NOT_RUN；任一級/seed失敗或未知停止升級，不能跳級 |
| D1 完整遊戲完成 | 5.1–5.3；E12 DONE | 凍結單版；可見打開指定Unity；Jev選擇、授權工具執行；同版Windows包完整遊玩 | 全S01–S08、四難度自然勝敗/重試/暫停/失焦、音效、實體手把；使用者體驗確認、正式APPROVED/授權merge/postmerge | NOT_RUN；所有必要測項同版PASS且22/22才SPEC completed，發布另授權 |

本次使用者要求「依據任務清單變成執行步驟，再逐一實作、驗證、完成目標」，承接上一則已具體化並審查的一次v2修訂，續行A1；不解讀為無限重試、補查provider、額外窗口、remote mutation或跳過正式審查。v1證據保留，A1若再失敗立即停止新查詢，先交付確切阻礙及最小修訂，不能為完成表格改變SPEC。

A1最新結果：run `e6656535-3a39-43ab-a093-31400787db8f`，source `2771abd64a7b1cec3286cd9852ce62e62edf5fd1`；CIM3/4，第四CIM及registry/files未開始，Player未啟動、counter0/3。raw、三份step及analysis已保存並獨立核對；晚回schema不能轉成來源PASS。此v2一次已使用，A2–A3/A6出口仍受阻，沒有自動第三批metadata。

下一個方法準備僅分析既有raw及官方來源，不採樣：raw中的`RegistryKey={5c3b2414-fd1d-44fb-8b00-e3194209dd1a}`是定位線索。Microsoft [class qualifier文件](https://learn.microsoft.com/en-us/windows/win32/wmisdk/class-qualifiers-for-performance-counter-classes)將RegistryKey描述為服務performance key；[V2文件](https://learn.microsoft.com/en-us/windows/win32/wmisdk/performance-libraries-and-wmi)另列_V2Providers的provider GUID。這兩份文字不足以將本raw GUID直接當V2 providerGuid或GPU producer。官方[CTRPP](https://learn.microsoft.com/en-us/windows/win32/perfctrs/ctrpp)的ApplicationIdentity是counter字串資源binary定位，也不等於實際資料producer載入證明。因此不直接猜registry分支/DLL、不把資源檔hash當producer證據。下一個可執行來源定位方案必須先解決此綁定與deadline方法、列清必要read/fields/deadline/次數，再受審及具體授權；目前不是可直接重跑的v3方案。A4/A5的獨立scope準備不解除此gate；正式單元依原次序退出。

官方方法定位新增候選（僅文件，NOT_RUN）：Windows原有[PerfQueryCounterSetRegistrationInfo](https://learn.microsoft.com/en-us/windows/win32/api/perflib/nf-perflib-perfquerycountersetregistrationinfo)可對指定counterSetId讀registration；[PerfRegInfoType](https://learn.microsoft.com/en-us/windows/win32/api/perflib/ne-perflib-perfreginfotype)分別提供英文counterset名稱及provider GUID。它可用來檢驗「raw RegistryKey GUID是否為該counterSetId」的假設，而不是直接將該GUID當provider。後續先審固定GUID、英文名必須GPU Process Memory、local machine/null、固定buffer／回傳長度／error／每call和總deadline／無自動resize重試／總呼叫次數及離線ABI負例；未審與未批准不呼叫。即使registration對應成功，也只縮小身分缺口，不證明producer implementation/version、時鐘語義或本機deadline會通過，不能解除A1/A2 gate。

2026-10-08（Asia/Taipei）；第一個 eligible 單元 U1，對應 OpenSpec tasks1.1–1.3。規格審查版本 `6c5282bf752e71dd54e69de14819f32b74d0dd5c`；當次使用者指示「你審查spec, 通過之後開始spec」支持本機執行準備，不自動授權push／PR／merge／provider／美術傳送。原E12兩輪修正預算保持用完，本次未修量測器。

**目前狀態（task1.3方案退出）**：task1.1／1.2／1.3完成；以下歷史追加段保留當時狀態，不能當目前台帳。2026-10-08使用者同意下一步並明確接受M2-T工程量測定義，獨立方法審查接受M1–M7/M2-T與B/T/F成本對照修正；新範圍限本方案精確allowlist/fixtures與最多3短probe/12成本probe，不重設原budget。方法接受不等於工具可用，全部新runtime能力NOT_RUN；task1.4正式approval／獨立merge授權／postmerge仍未齊，不開始unit2。

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

成本probe提案：20及300人、seed7、normal、每run暖機30s/採樣60s，模式順序B/T/F/F/T/B，共12runs；先鎖定合法輸入route、camera/交戰/無雙/倒地事件。B/T沒有ID/coverage pass，其visible明確為NOT_MEASURED，不是0、正式visible或缺失的工具能力，不借用F的值填補。三模式共同workload證據為同版合法inputs、camera/geometry/pose/material/phase來源及alive/engaged/attackers/frustum四數；逐simulation tick比對這些來源的identity與事件/四數一致性，任一差異或無法對齊即WORKLOAD_INCOMPATIBLE，不以鄰近wall-frame或跨run的F visible推定一致。F另須在兩次run各自取得完整同幀pixel coverage/visible，依M2/M2-T處理未知、失敗與收尾；任何必要F visible缺值仍BLOCKED。若同phase workload不相容或自然結局太早，保存失敗，不補血/無敵/teleport，也不裁掉受影響幀；須先修路線並重審，不能重設E12舊budget。這12runs僅工具成本，不能代替正式三seed分級或180s成績；未經task1.4 gate不得執行。

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
- 2026-10-08使用者明確同意必要範圍追加：`scripts/unity-validate.mjs`僅在既有testInventory登錄新增PerformanceScopeEditTests/PerformanceTelemetryEditTests及後續PerformanceTelemetryPlayTests的實際case數。原所有class/count、exact total驗證、安全控制及五階段完整驗證保持，不以此追加改stage/門檻/版本或跳過測試。
- 待批准的第二項必要 runner 追加：`scripts/e12-probe.mjs:37` 要求 validation.playerPayload，但 main runner 只記 playerSha256/characterStreamingCopySha256，沒有完整包清單，故即使五階段通過仍會拒絕短 probe。提案僅重用既有 `scripts/lib/e12-process.mjs` 的 snapshotPayload：build 完成時保存完整 Player 目錄相對路徑、bytes、SHA-256；普通 Player 驗證結束後重新盤點並要求與 build 快照一致，加入 result.json 的 playerPayload。清單包含 exe、DLL、Data/StreamingAssets 等全部普通檔案，沿用 requireSafePath 拒絕逃逸/reparse，既有欄位保留。只補 build provenance，不改 stage/argv/timeout、套件、品質、素材、exact tests、runtime verdict 或 probe quota。runner 測試可在既有 `scripts/tests/unity-execution.node.mjs` 增加完整 payload 正例、DLL/資產新增刪除或替換負例及不安全路徑拒絕；此測試檔亦屬待批准追加。未獲人類同意與獨立範圍審查前不實作。已有 snapshotPayload substitution fixture 可重用；未生成完整清單者維持 PLAYER_PAYLOAD_MISMATCH，不弱化 launcher gate。
- 紀錄：`docs/engineering/UNITY_E12_CAPABILITY_PLAN.md`、`UNITY_E12_CAPABILITY_STEP_RECORD.md`（同docs/engineering目錄）、`openspec/changes/unity-migration-followup/tasks.md`；raw新run在`release/e12/`exclusive leaf，local-only。舊source由精確列檔採用，不整批cherry-pick或刪PR44配置。

上述完整包提案的獨立來源審查另發現既有 snapshotPayload 使用一般 {}，根目錄普通檔名 __proto__ 會被當 prototype setter，導致清單/JSON 漏檔；故重用前必須在原 allowlist 的 e12-process.mjs 改用無 prototype 的清單，並在既有 e12-performance.node.mjs 增加該檔新增/替換/刪除回歸。這是完整性修正，不把未修 helper 稱為可靠全包驗證。已查 FoundationSmoke/ZhaoYunCharacter 在 -e02Output 寫出證據，runner -logFile 亦指向獨立 output，未帶 route/probe 旗標不啟動其 recorder；不將 output 移入 build/player，也不排除包內普通檔案來通過比對。

2026-10-09 使用者回覆「同意」，批准上述第二項完整包 runner/test 精確追加；前述「待批准」保留為歷史提案，最新狀態為已批准此範圍。獨立 pre-implementation review 接受重用 snapshotPayload、原 helper 內純 comparePayload 與固定 build 快照；Player 成功退出後先另存快照及排序穩定的 added/removed/changed，再驗 runtime 報告。快照失敗或任何包異動維持 BLOCKED，保存原快照/error，不以空集合、更新基準或排除檔案通過。觀察前後一致不證明期間沒有短暫異動。原精確 stage/argv/timeout、安全控制、素材、採樣額度及 remote 邊界維持。

### 下一個待批准追加：三 seed 的 controller 銜接

- 必要性：task2.4／4.2 要求 seed7/11/23；目前 controller 的 UseDummies(dummies) 只以預設7建立 HitTargets，readonly RNG 沒有 reseed 介面。已支援多 seed 的既有 HitTargets constructor 可直接重用，無須修改 Combat／AI 演算法。只改報告或出生 seed 不能證明 AI seed 已使用。
- 精確新增檔案範圍僅 unity/ChangshanLongdan/Assets/Character/Runtime/ZhaoYunController.cs：保留原單參數 public API，新增 UseDummies(dummies,uint seed) overload；private Build 接受預設 HitTargets.DefaultSeed 的 seed 並傳到既有 constructor。原初始化、單參數與 pressure crowd 都維持預設7。一般 controller API 不新增三 seed 限制；三 seed allowlist 僅屬 probe。
- 原 allowlist 的 PerformanceProbe guard/實際呼叫與 report 使用同一驗證 seed，接受7/11/23、拒絕其他；PerformanceTelemetryPlayTests 使用固定相同 spawns 對照獨立 HitTargets/simulation 的 seed 敏感欄位及合法 Tick，驗三 seed、原單參數與顯式7等價，以及 Restart 延續 RNG／重建 targets 才建立新 seed 流。fixtures 關閉自動步進。runner 僅依實際 source 登錄 case 數，已有測試登錄授權，不先填 PASS。
- 獨立方案審查接受此必要最小追加，但新增 controller 檔案仍待人類明確批准；批准前不修改 controller/guard 或新增此 runtime test。不改 difficulty、Reset RNG、input、資產、門檻、probe quota，沒有額外採樣/provider/remote 授權。此追加不解除 clock/visible/timing/workload 或正式完整遊戲 gates。

2026-10-09 使用者明確「同意按照建議實作」，批准上述新增 controller 精確範圍；前述待批准為歷史提案。獨立實作前審查接受 overload、probe guard/coupled report、相同 spawns 的三 seed reference／合法 Tick／Restart 延續／重建序列及原 API 等價測試。測試使用 owned camera/Effects、OfflineAudio 與停用自動 Update，僅證明 seed 銜接，非音效或自然玩法接受。本輪 boot 仍固定20人/spawn7/AI7，不因 API 支援宣稱 launcher 三 seed 實測已完成，仍不新增 provider/probe 或額度。

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

## 2026-10-09 下一個必要決定：指定 Player 的 clock-only 對照（未執行）

目的僅為task2.1的此環境／此Player來源時鐘子gate。現有helper要求TimezoneId但launcher未傳，schema2的mapping標記仍未驗證；不能只把標記翻成VALIDATED。舊native raw只保存timezone/script/samples，沒有當時OS/provider版本，不能用現在版本倒填舊證據。舊sandbox3／host3／native3全部已用完；unit2三seed完整短probe與12成本probe不可移作這項前置診斷。

採用既有 `Capture-E12ClockComparison.ps1` 的 PDH/原生UTC interop、`e12-probe.mjs` 的固定完整包/PID/runId/exclusive output/own-handle收尾，以及e12-process的安全path/payload/watchExit。新增常駐provider、套件或native plugin無必要。新增授權僅為一個明確模式與一組獨立額度，不開放一般provider探索。

| 項目 | 可審查的精確提案 |
|---|---|
| 指定baseline | validation worktree exact `6edf1e0c008a74db02fc541f73b76e45a12c17ba`、run `c3867e43-9b1c-4121-ac1a-e5dda5f37339` 的驗證Player；319檔清單hash `474e32adfce14824ce8b81815089a120bf5f7aab0ca158529131a8e1d38dc002`。實作後若code SHA改變須先按原五階段產生新同版validated包，再凍結新的code/full-payload hash，禁止沿用舊版PASS啟動新候選。 |
| 新增檔案範圍 | 只將既有 `scripts/diagnostics/Capture-E12ClockComparison.ps1` 加入unit2 allowlist，增加明確Player模式，保留歷史raw和原模式。其餘僅原allowlist的e12-probe/e12-performance/e12-process/e12-gpu-telemetry/e12-performance.node及兩份PLAN/STEP_RECORD；不改unity-validate階段/argv/timeout，沒有其他新檔。 |
| 先做而非先取樣 | ClockContract分開記指定local-encoded方法、timezone、namespace/class/countertype/clock field/frequency、證據hash、本次environment、verification；歷史支持維持UNVERIFIED。先完成純fixtures、PowerShell語法/interop ABI、來源scope/exact-SHA獨立審查；未批准不實作新增診斷模式或取樣。 |
| 單次啟動 | 本機一個新run/exclusive `release/e12/player-clock-v1`，launch自己凍結的可見Player；argv鎖定 `-screen-fullscreen 0 -screen-width 1920 -screen-height 1080 -force-d3d11 -e09NoFlow -logFile <run>/Player.log`。不帶-e02Output（避免120幀自動退出）、不帶-e12Probe；無合法輸入route或benchmark主張。launcher記runId/驗證run/source/fullpayload/exe、自己child PID/start/imagepath。ready只核對自己的process身分/liveness與主視窗，不查GPU/CIM/PDH；任何為等待GPU instance的provider查詢一律算入3窗口，禁止不計次readiness polling。不得attach別人的PID或使用任意GPU process。 |
| 前置metadata | 一次有界readonly OS build/version、GPU driver版本及指定CIM class/provider schema/qualifier身分盤點；只讀必要公開系統版本資料，不讀憑證/帳戶/其他process資訊。實作前列明實際來源/固定必要version字段；不能確認provider implementation/version時保存null並BLOCKED，不拿class名稱或OS版本冒充provider版本。此metadata不是效能取樣。 |
| 取樣額度 | **僅一次執行，最多3個query windows**，每window查全部該Player完整adapter集合，逐instance同名WMI raw clock/frequency與PDH raw clock/API/CStatus/type；不保存、不輸出、不分析Dedicated Usage bytes，PDH API native struct必要回傳的數值欄位不進證據，不列VRAM成績。每來源保留獨立原生UTC FILETIME前後與monotonic tick/frequency/query窗口、timezone/rule/實際offset。每來源query仍≤2s，包含PDH呼叫耗時；實際deadline/收尾在script review驗證，超限拒絕。整run硬上限90s。一個失敗窗口也消耗一次，不補跑第4窗。 |
| 身分及來源拒絕 | query前後同PID/processStart/image；adapter名稱/key唯一，集合变化、缺instance、PID重用、unknown fingerprint、clock frequency或timezone/rule不符即BLOCKED。metadata/任何window失敗立即停止新增window並保全已取raw。 |
| 判讀 | 事先固定local-encoded轉換，raw保留；UTC解讀僅反證比較，不依最接近query選方法。100ns整數、DST ambiguous/invalid拒絕、lag≤2s/future≤250ms、query≤2s/UTC倒退與monotonic不符等原門檻維持。全部必要instances/來源同時通過與獨立結果審查才可生成綁定此run/environment/raw的clock mapping驗證結果；任何unknown不改標VALIDATED。不是RAM/VRAM/逐幀alignment或task2.1整項PASS。 |
| 收尾／預算 | 只停止自己launch handles，前後完整包與source清單核對。禁止終止其他Unity/Hub、刪歷史lock/證據、改時區/品質/門檻、遠端/付費/provider服務。新3窗屬單獨clock-only決定，原各已用額度、3次完整短probe及12次成本probe全保留；失敗後不能重新計數或新增採樣。 |

Authorization Envelope（僅提案）：Destination=上述本機隔離project/凍結Player/自己的clock-only run leaf與Win32/CIM/PDH；Purpose=指定Player來源時鐘對照；Allowed=核對包/source後單次launch、上述版本metadata與最多3window、local-onlyraw/analysis、own-handle收尾；Data=run/PID/start/adapter/時鐘/公開環境版本，沒有source/log外傳；Forbidden=完整probe/benchmark、其他process/secret、remote/provider/付費、時區/ACL/品質修改、追加window；Stop=任一必要未知/身份來源不符/timeout/包source異動。人類需決定此新增取樣scope/額度，尚無採樣或實作。

獨立提案審查advisory accept，足以供人類窄scope決定。批准後先在本PLAN鎖定metadata的固定來源/必要字段/查詢次數與deadline；若無法確認必要provider implementation/version，即metadata階段BLOCKED，不能擴大registry/provider探索。實作與exact-script review須另外驗證精確argv、ready條件、全部provider查詢計次及2s/90s執行控制，不能只靠本文件稱enforcement已存在。這個新增決定不修改SPEC目標或完成條件。

### 已批准的 metadata-first 實作契約

2026-10-09 使用者明確：「同意依 b361d76 提案，新增一次 Player 時鐘對照，最多三個窗口」。上述待決定文字保留為歷史提案；此授權只新增這一組上限，不重設舊額度。獨立 pre-implementation review 接受先做一次 metadata-only，沒有 Player／PDH／GPU instance 查詢，counterWindows=0；若必要來源綁定未知就在這一關停止。正式 Player 啟動前才須新程式同SHA五階段，不把 metadata-only 當 Player runtime。

固定依序、不得重試：CIM root/cimv2 的 Win32_OperatingSystem（Version/BuildNumber，1結果）、Win32_VideoController（Name/DriverVersion/PNPDeviceID，全列表且必要字段齊）、精確 Get-CimClass Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory（class/property qualifiers/schema，1結果）、__Win32Provider filter Name='WmiPerfInst'（Name/CLSID，1結果），合計最多4次CIM。後接一次64-bit HKLM SOFTWARE/Classes/CLSID/<單一合法GUID>/InprocServer32 default read；只接受解析後System32/wbem/WmiPerfInst.dll，不執行registry值、不載入DLL、不搜尋替代。最後一次固定檔案群讀取WmiPerfInst.dll、System32/pdh.dll、System32/drivers/dxgkrnl.sys的FileVersion/SHA256。各來源實際≤2s，metadata程序由controller spawnSync timeout20000ms硬停止；完成step各自CreateNew保存，kill/失敗保留既有step，不啟動後續查詢。必要結果/欄位缺失立即停止，總共只執行這一批metadata。

註冊DLL只形成wmiBridgeIdentity，counter schema與environmentVersions分列；loadedModuleProven=false，gpuCounterProducerBinding=null，clockMapping=UNVERIFIED。即使四次CIM及registry/files成功，也只記METADATA_OBSERVED_CLOCK_MAPPING_BLOCKED；不能用三個系統DLL或driver版本代替精確GPU counter producer綁定。Microsoft官方[WmiPerfInst](https://learn.microsoft.com/en-us/windows/win32/wmisdk/wmiperfinst-provider)明確說明它是PDH與WMI的bridge；[GPU資料來源](https://devblogs.microsoft.com/directx/gpus-in-the-task-manager/)只說明Task Manager與VidSch/VidMm，不單憑該文將特定CIM class綁定dxgkrnl檔案。後續判定只能分析這次既有metadata/官方source；禁止自行新增metadata查詢或counter windows。

### metadata 啟動失敗與精確修訂提案（未重跑）

單次 run `1d9c7775-cf31-481a-a52e-56129db70cac` 在建立 record 的 Get-FileHash 即 exit1；沒有進入任何 CIM／registry／固定檔案群組，也沒有 Player／counter。此嘗試已使用，保留 `release/e12/player-clock-v1`；不得因窗口0/3而自動重跑一次性批次。

新的非 provider 環境對照已定位：pwsh→Node→powershell.exe 繼承 PowerShell7 的 PSModulePath 時，Windows PowerShell5.1.26100.6899 無法解析 Get-FileHash；只從該 child 的 env 移除 PSModulePath，讓5.1自行建立 WindowsPowerShell 模組路徑，同一 Get-Command 成功。沒有修改 user/machine env、模組、ACL、全域配置或執行任何 CIM。既有離線 AST/ABI fixture 已延伸到 pwsh.exe 與 powershell.exe；5.1 child 使用此隔離 env，並先 Get-Command 核對 Get-FileHash/Get-CimInstance/Get-CimClass/Select-Object/ConvertTo-Json，僅命令解析、不取系統/provider資料；兩者均 PASS。

**待人類決定的最小重試**：只重做一次相同 metadata-only 批次，fresh exclusive `release/e12/player-clock-v2/metadata`；controller 只修改 child env 刪除繼承 PSModulePath，其餘固定來源/最多4CIM/各來源2s/總20s/失敗停止/CreateNew/來源核對維持。原v1全部保留；此次若再失敗不補跑。這不新增 Player/counter窗口，原一次Player對照上限仍0/3，其他已用額度/三seed/12成本probe不變。必要producer binding未知仍停，不以環境修復宣稱來源或SPEC通過。批准與exact-candidate review之前不執行v2。
