## Context

SPEC v2 於2026-10-12依使用者「現在改spec」授權修訂。v1 基準 `a52b79eefb6cc90a3b12bf152bbec8c32e8620b1`、22項對照、分工與人工驗收清單見 [v2決策紀錄](../../../docs/engineering/UNITY_SPEC_V2_DECISION_RECORD.md)。這是方法收斂，沒有新增實測額度、延後必要測項或放寬數值。

現況與版本見 [移植盤點](../../../docs/engineering/UNITY_MIGRATION_RECONCILIATION_2026-10-08.md)。main 已有 Unity 工程與 E11；E12 工具在未合併分支。需求是整理後續，不重新移植全部功能，也不把歷史限定接受提升成完整 VERIFIED。

## Goals / Non-Goals

**Goals:** 明確工程／美術責任，恢復 E12 量測可信度，形成固定品質基線，再以同一版本完成效能和可玩版本驗收。

**Non-Goals:** 本次 runtime 或資產實作、Unity WebGL／其他平台／IL2CPP／Editor 升級、新戰役／新玩法、付費生成、全域 Jev 改動、發布。保留 TS/Web、既有授權及證據。

## Decisions

### 1. 沿用工程與分步契約

Adopt 現有 Unity 6000.6.4f1／URP17.6／Windows x64 Mono／D3D11、`unity-validate.mjs`／`unity-execution.mjs`、parity、step record；Extend 既有 E12 量測候選。重新建引擎或新增原生 plugin 並未解決已知缺口，亦增加依賴。`.codex` 設定與候選 profile 不改，文件不是執行強制控制。

### 2. 能力工程與品質交付分開，但正式 benchmark 有共同前置條件

先做 E12 新證據／受審查方案，核對候選與 main 差异，不盲目 cherry-pick；再最小範圍修正量測與測試。此單元可用清楚標示的既有／佔位資產檢驗工具，產出 CAPABILITY_PROBE；不能宣稱正式效能或品質 PASS。

先明確選擇現有資產並鎖定 GLB／manifest hashes，核對來源、授權、實際 QA；現有資產不是自動 ACCEPTED，缺資料保持 UNKNOWN。只有品質缺陷需要製作／修改時才走新美術交付，不強制為合格現有資產產生新 delivery_id。美術工程師負責角色製作端，工程主控負責匯入、蒙皮 bridge、載入 fallback 與工程證據，使用者負責自然操作及視覺體驗確認。必要需求 packet 核對 request_id、指定工程師／工作區／傳輸資料、來源可取得性與授權後才送出；沒有送達／接單機制不稱背景製作。狀態區分 PREPARED_NOT_SENT、已送達／IN_PROGRESS、DELIVERED、INTEGRATING、ACCEPTED；交付自評不是遊戲驗收。

所選現有或修復資產與可能 runtime 修正同一整合單元，完整 rendered／自然操作／review gate 前不合併穩定基準。保留 21 骨、17 招式、4 influences、root-motion=false、tip/tipBase、FootPlant、可見 fallback；material count 從鎖定 GLB 實際盤點，不從缺欄位 manifest 推定。

使用者明確接受既有 run `3ecafcf1-eca2-4985-a76e-c6eec0f4c694` 畫面中的衣角拉伸，限 spec「已展示衣角的限定視覺例外」所列 code／GLB／截圖 hashes。狀態為 HUMAN_ACCEPTED_VISUAL_EXCEPTION，不稱修復；該限定現象不再單獨阻擋，但其他部位、未展示姿勢／動作、後續版本及全部技術／自然操作 gates 仍須驗收。美術交付與完整品質單元未因此完成。

### 3. 補足量測的來源語義

VRAM 保留 raw timestamp／query start-end／PID／processStart／adapter，先證明時鐘基準和 UTC 轉換。沿用 sample lag≤2s、future≤250ms、query≤2s、有效高水位；失敗不回填 0、不降低 freshness。Counter 必須完整 category/name/unit 匹配，無資料為 null。GPU／CPU delayed sample 要定義 frame identity、latency、重複、暖機、收尾；有 gaps 不靜默剔除。

來源不限定 WMI。替代 provider 必須先提出原 counter／unit 的等價映射、指定 Player 的 PID／processStart、adapter 全集、raw timestamp 與 UTC 轉換、query window、freshness／future／高水位及失敗語義，經方法審查與正負邊界測試後才能納入；API 名稱不構成等價證據。無法證明的必要指標仍 UNKNOWN／BLOCKED。沿用已用兩輪修正預算及既有時鐘對照批次（最多三窗口、第一窗口逾時即停）的終止結果，不使用未跑窗口續試。新來源或新方法須有新定位證據、受審查方案及人類明確的操作／次數／窗口／停止條件授權；本次 spec 修訂不授予新嘗試。額度耗盡後只交付已有證據與可離線完成的診斷，需新增授權或修改需求時明列決策，不無限重試。

真正可見數方法在實作前評估 camera-specific occlusion/pixel 來源與額外成本，保留 alive／engaged／attackers／frustum／visible 各自語義。前景 PID、focus、minimized 與實際 render 對齊。固定 workload 用合法玩法與固定 seeds 涵蓋交戰、無雙、倒地峰值，DEV 補血／無敵／teleport 不能冒充自然操作。

### 4. 延續數值 gate 與版本綁定

正式 20→50→100→200→300、seed7/11/23，各暖機30s＋採樣180s，再30min soak。1080p、renderScale1、實際 Player readback 的硬體／driver／VSync／refresh／frame cap／build flags 與固定版本一併登錄。nearest-rank `ceil(q*n)-1`，不先四捨五入；CPU active=`max(p95(main),p95(render))`≤16.67ms，GPU p95≤16.67ms，wall p99≤25ms，wall>50ms 比例≤0.001；CPU/GPU 不相加。CPU counter 已扣等待不再次扣，ns→ms與FrameTiming ms分列。

沿用原跑前 memory budgets：Private Bytes≤4GiB，dedicated VRAM≤2GiB；soak 首尾完整60s中位數差 Private≤max(64MiB,5%)、GCused≤max(16MiB,5%)、VRAM≤max(32MiB,5%)；最後20min每分鐘中位數 slope 分別≤1／0.5／0.5MiB/min。GC absolute cap 尚未另定，不能 invent；OS budget／paging 未有來源保持 UNKNOWN。任何必要來源未知或級別 FAIL 停止升級。

### 5. 同版本 E13 與每單元退出

每單元先 scope review、精確允許檔案、V/S、正負邊界測試與raw evidence，再獨立 exact-head review、該單元 merge 授權與 postmerge compatibility；缺門檻不開始下一單元。E13 freeze code/profile/asset/full build hashes，從輸出 Windows 包測全部 S01–S08、四難度、自然勝敗、重試／暫停／失焦、音效、實體手把與效能；不同舊 SHA 的 PASS 不拼接。明列目前城池佔位範圍，未承諾改造不暗加，未驗收不冒稱最終美術完成。

### 使用者補充：Unity／Jev最終驗收與進度

2026-10-08使用者要求依SPEC繼續、每次報完成度、最終打開Unity用Jev執行遊戲且通過所有測試。沿用22個tasks；每次交付報completed/22、百分比、當次完成項目、未完成gate及下一個eligible步驟，比例僅任務計數。原task1.3/1.4與每單元合併gate不跳過，最終測試不提前替代當前前置條件。

Jev現況以執行時workspace `jev_status`回讀為準；歷史設定為enabled=true、threshold0.9、timeout10、advisory_only=true，不當作當前工具已可用。官方[Choice](https://docs.typesafe.ai/primitives/choice)提供選項/機率/信心。2026-10-08原採「Jev選擇，Unity工具執行」；v2明確允許使用者作為人工 executor 執行可見Editor開啟與Player合法操作，agent負責既有CLI工程測試、版本與證據核對。Jev在充分且可傳送的去敏state中支援選擇，記錄實際工具或人類操作者及遊戲結果。缺自動UI工具不再單獨阻擋人工執行，但缺任何實際執行證據仍UNAVAILABLE／NOT_RUN；Jev缺失也不能偽造Choice或outcome。不得改全域配置或冒稱agent已操作實體裝置。

在E13 eligible階段先記錄指定project絕對路徑與凍結code/profile/asset/full-build hashes，preflight實際Editor版本/專案鎖/執行工具。可見打開Unity6000.6.4f1 Editor及指定project，保存啟動/專案身分/Play或操作證據；另執行同版輸出Windows Player。Editor、輸出包、自然操作、感官/實體手把是分別的證據，不能互代。必要Unit/Node工具、Web相容/parity、Unity compile/Edit/Play/build/Player、正式E12/soak與完整E13 S01–S08矩陣均綁同版本；工具開啟、Jev成功或CI綠不等於全部驗收。

人工證據逐測項記錄實際操作者、時間、凍結版本、Editor／Player身分、合法操作、原始畫面／操作紀錄及PASS／FAIL／NOT_RUN與原因；聲音及實體手把須由使用者實際感受／操作並記錄裝置。單句「玩過／可以」不替代矩陣。使用者負責產品體驗確認，技術獨立agent只提供advisory；正式exact-head批准須由具資格的獨立審查者實際提供，遵守GitHub counted approval與branch protection，不能以使用者自行合併或U1歷史限定接受推定未來批准。

Jev記錄只包含允許傳送的窄state、可用候選/合法操作、capture/執行時間與state版本、Choice/confidence及採用/拒絕原因；不傳私有source、完整log/對話或憑證。選擇後再次檢查state新鮮度、合法性及授權；低信心/錯格式/未知/timeout不執行候選、不填PASS。recorded observation須回報對應outcome，caller metadata與實測證據分列；API/採樣額度依eligible單元先登錄，不重設舊預算、不引入每幀外部AI。Jev只支援驗證流程，不決定combat結果、測試是否通過、審查批准或merge。

最終只有全部22項完成、全部必要同版測試PASS、使用者體驗確認、正式獨立APPROVED、已授權merge及postmerge相容性齊備，才稱SPEC completed。任一FAIL/UNKNOWN/SKIPPED/NOT_RUN或executor缺失均保持未完成；不為完成率移除必要測項或把未測判NOT_APPLICABLE。

## REA 靜態支持方法（2026-10-11）

依使用者要求，Adopt 獨立鎖版 `tools/rea` 的 `rea-agents@6.4.0`，以官方 managed CLI 支持 2.1／2.4 的 DLL 身分與 CIL 調查。實際用法、五項正負邊界檢查與版本限制見 [REA_SPEC_SUPPORT](../../../docs/engineering/REA_SPEC_SUPPORT.md) 及其 STEP_RECORD。這是靜態支持方法，原 22 項、Unity／Player／美術／效能／自然操作與 formal gates 保持不變。

既有 Library DLL 的 code／完整 build 對應 UNKNOWN，不當作同版 Player；沒有 Character DLL 就保留缺口。REA 不證明 producer 時鐘、freshness 或 runtime 行為，不新增任何 Unity／CIM／PDH／Player 窗口，不重設舊預算。完整分析輸出保持本機；不作全域配置、skill 安裝或 native／runtime capture。

## Risks / Trade-offs

- 既有 E11 formal review 缺口 → 保留歷史限定接受和缺口，實作前明示可接受前置狀態，不自我批准。
- E12 原兩輪 budget 用完 → 先新定位證據與方案審查，不重設，保留原失敗產物。
- 所選資產來源／授權／QA不齊或品質失敗 → 阻擋資產品質單元；必要時委託美術修復，現有資產合格則不強制新交付。正式 benchmark 不繞過品質。
- 可見數／GPU timing instrumentation 可能擾動效能 → 跑前登錄成本對照方法，未知保持 BLOCKED。
- 外部人類 reviewer／實體裝置尚未齊備 → 保留 NOT_RUN，草案 advisory 不能替代正式 APPROVED。

## Migration Plan

本次只建立文件 checkpoint。後續每單元使用隔離 worktree／feature branch，保留 Web；普通 revert 該單元提交回復上一已驗證基準。保存失敗 trace、來源 GLB 與版本化候選；不 reset、clean、force-push 或刪除證據。發布需獨立授權與真站／輸出包驗收。

## Open Questions

- 新 timestamp 根因證據、真正可見數來源、timing frame mapping 與量測成本的具體方案待能力單元先行審查。
- 若確需新製作／修改，須核對美術工程師接單目的地、受控 `.blend`、交付時間與實際 packet 送達；現有資產路徑先核對其既有來源與QA。
- 正式 qualified reviewer、固定品質候選、workload cycle／自然操作路線、使用者實際裝置與驗收時間待登錄。自然操作與感官責任已指定使用者；未知身分或證據仍是執行前置條件，不阻止本次 spec 文件交付。
