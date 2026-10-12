## ADDED Requirements

### Requirement: 可追溯的移植現況與平台範圍

工程紀錄 MUST 分開登錄 source、歷史 tests、render、自然操作、formal approval、merge 和 postmerge。SHALL 保留 E00–E10 限定接受、E11 已合併但正式審查缺口、E12 未合併受阻候選及 E13 未開始；MUST 不把舊台帳或 profile snapshot 當即時 runtime 真相。平台 SHALL 沿用 Unity6000.6.4f1／URP17.6／Windows x64 Mono／D3D11，保存 Three.js Web／itch。

#### Scenario: 舊台帳與 Git ancestry 不同
- **WHEN** 台帳稱 E11 未合併而 main 已含 PR43
- **THEN** 盤點列出 merge SHA 與可定位來源，同時保留 review／體驗缺口，不倒填 APPROVED。

#### Scenario: 新平台需求出現
- **WHEN** 有人提出 Unity WebGL、IL2CPP 或其他平台
- **THEN** 另行決策審查及授權，本 change 不宣稱已涵蓋或已驗證。

### Requirement: 美術製作與 Unity 工程责任

遊戲工程 SHALL 先明確選擇現有資產基線，記錄 GLB／manifest hashes，核對來源、授權與實際技術 QA；缺失 MUST 保持 UNKNOWN／BLOCKED，選用不等於 ACCEPTED。只有需要製作／修改時才委託美術工程師負責來源、修復與匯出，遊戲工程負責 Unity runtime、量測、匯入及工程證據，使用者負責自然操作與視覺體驗確認。必要委託 MUST 依 asset-collaboration 核對指定工程師、工作區、來源、傳輸資料與動作範圍；實際送達未知 MUST 保持 PREPARED_NOT_SENT。新交付 MUST 使用新 delivery_id、來源／GLB hashes、技術 QA 與授權；既有資產不得虛構新 delivery_id，不得覆蓋原資產。兩種路徑 MUST 通過相同整合品質 gate。

#### Scenario: 選用現有資產
- **WHEN** 現有資產來源、授權及 QA 可核對且後續完整品質驗收通過
- **THEN** 不強制新美術交付，依實際證據退出3.1–3.5，不把選用本身判為品質PASS。

#### Scenario: 現有資產品質或來源不符
- **WHEN** 來源／授權／QA未知或有未受限定接受的品質缺陷
- **THEN** 保持BLOCKED或FAIL；需要製作／修改時走美術協作，不以文件修訂或既有衣角例外豁免其他缺陷。

#### Scenario: 只有需求草案
- **WHEN** 需求存在但沒有送達／接單證據
- **THEN** 不宣稱已委派、製作中或完成，獨立量測準備可繼續。

#### Scenario: 收到美術交付
- **WHEN** 新 GLB 與 manifest 到達
- **THEN** 只標 DELIVERED，核對 hashes／契約後進入 INTEGRATING，遊戲品質驗收通過前不標 ACCEPTED。

### Requirement: 既有預算下的量測能力恢復

E12 工程 MUST 重用既有候選與 runner，先提交新定位證據和受審查方案，保留兩輪已用 budget；不得重新命名來重新計數。MUST 精確辨識 counter category/name/unit、timestamp 時鐘與 UTC、Player 身分及高水位；必要數據缺失 SHALL 為 null／UNKNOWN。短 probe SHALL 僅支持能力結論。

量測來源 SHALL 不限定 WMI；替代 provider MUST 先審查與原指標的等價性，保存 counter／unit映射、指定PID／processStart、adapter全集、raw timestamp／UTC轉換、query start-end與有效高水位，沿用 sample lag≤2s、future≤250ms、query≤2s。MUST 測試錯counter／unit、PID重用、缺adapter、stale／future、倒退／重複／missing；未知不填0。新方法 MUST 取得新定位證據、方法審查及人類明確的操作／次數／窗口／停止條件授權後才實測。MUST 保留既有最多三窗口批次第一窗口逾時即停的終止結果；不能用未跑窗口續試。本次v2不增加任何實測或修正額度。

#### Scenario: 替代來源等價且證據齊備
- **WHEN** 替代provider通過等價性審查、正負邊界測試並在明確新授權額度內通過指定Player對照
- **THEN** 可作為量測來源，所有品質、freshness與正式E12數值gate仍適用，不直接標2.1或E12完成。

#### Scenario: 預算耗盡或新來源仍未知
- **WHEN** 原批次已終止、新實測未授權，或替代來源無法證明必要語義
- **THEN** 保持BLOCKED，不新增實測、不重設額度；交付既有證據與可離線完成的診斷，另列新增授權或需求調整決策。

#### Scenario: 時鐘或 counter 身分不正確
- **WHEN** VRAM timestamp 未符合原 freshness 或 draw counter 指向 UI Toolkit
- **THEN** 記 BLOCKED，禁止 formal benchmark；不得改窗口或將 unknown 填0。

#### Scenario: 能力測試通過
- **WHEN** 工具單元正負邊界 tests 與短 probe 通過
- **THEN** 只記該版本能力結果，不標 E12 DONE，不把3+10秒當30+180秒成績。

### Requirement: 正式量測前的共同前置條件

正式 benchmark MUST 先鎖定品質已驗收資產、code/profile/full build hashes、硬體及 Player readback、固定交戰／無雙／倒地 workload、camera-specific 真正可見數、前景／focus／minimized、CPU/GPU timing 的 frame identity／latency／去重／收尾，以及記憶體時間對齊和工具成本對照。MUST 分列 alive／engaged／attackers／frustum／visible；不得以視錐或背景窗口減負載代替可見場景。

#### Scenario: 美術等待期間
- **WHEN** 鎖定資產品質尚未驗收，但工具可用明確標示的既有或佔位資產測能力
- **THEN** 允許能力工程證據，禁止正式品質／效能驗收結論。

#### Scenario: timing 或 visible 缺口
- **WHEN** 必要樣本未對齊或只有 frustum 數
- **THEN** 正式分級及 soak 保持 NOT_RUN／BLOCKED，不靜默捨棄缺樣。

### Requirement: 鎖定資產的整合品質 gate

所選現有或新交付資產與相關 runtime 修正 MUST 在同一整合單元完成 tests、雙引擎實際 render、自然操作、使用者視覺確認及 exact-candidate review 後才合併。SHALL 保留21骨命名／層級、17招式、4 influences、root-motion=false、tip/tipBase、FootPlant和可見載入fallback。MUST 在30/60/120Hz沿用握點p95≤3cm、plant≤5cm、扣除設計位移後root≤5cm；握點僅指定握持窗口，plant 排除設計滑步／擊退／空中，不能重訂原門檻。

#### Scenario: 資產技術 QA 通過但有拉伸
- **WHEN** 匯入正常而實際 idle／動作仍有未受限定人類接受的尖三角、跨部位拉伸或抖動
- **THEN** 品質 FAIL，不合併、不作正式 E12 基線。

#### Scenario: 已展示衣角的限定視覺例外
- **WHEN** 使用者明確接受 run `3ecafcf1-eca2-4985-a76e-c6eec0f4c694` 已展示的衣角拉伸（code `da959b40f229f2af66c52fd7bfd82353e422cc95`，GLB SHA-256 `7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33`，scene.png SHA-256 `2ef482a1fb32834cd0c9a1059868449cf7f88897a01fda9243fc5b1cf9370dd8`）
- **THEN** 該畫面已展示的衣角現象 SHALL 記為 `HUMAN_ACCEPTED_VISUAL_EXCEPTION`，不再單獨阻擋品質；保留原始形變與歷史 FAIL，不稱已修復。例外 SHALL NOT 自動延伸至不同部位、未展示姿勢／動作或後續版本；其他技術、render、自然操作、review／merge／postmerge及完整遊戲 gate 仍須驗收，不因此標資產整體 ACCEPTED 或 SPEC completed。

#### Scenario: 載入失敗
- **WHEN** 缺骨、非法weights、hash不符或載入失敗
- **THEN** 負例測試與可見fallback有證據，fallback成功不能標資產品質PASS。

### Requirement: E12 分級效能與穩定性

系統 MUST 依 design 的原數值門檻，在1080p/renderScale1下逐級20/50/100/200/300，每級seed7/11/23各暖機30s、採樣180s，全部通過才升級，再跑30min soak。CPU active與GPU p95各≤16.67ms、wall p99≤25ms、wall>50ms比例≤0.001；nearest-rank不先四捨五入、CPU/GPU不相加。MUST 沿用Private Bytes≤4GiB、dedicated VRAM≤2GiB及 design 列出的首尾 drift／最後20min slope門檻，保存raw與未知項。

#### Scenario: 某級失敗
- **WHEN** 任一seed gate失敗、必要指標未知、持續成長或渲染品質回歸
- **THEN** 停止該級之後測試並保存失敗trace，不以20人結果代表300人。

#### Scenario: 分級通過而 soak 缺失
- **WHEN** 五級成績齊備但30分鐘soak或回歸未完成
- **THEN** E12不標VERIFIED／DONE，E13不可開始。

### Requirement: E13 同版本可玩版本與退出

E13 MUST 在E12 DONE後凍結單一code/profile/asset/full-build版本，從輸出Windows包驗證全部S01–S08、四難度、自然勝敗、重試／暫停／失焦、音效及實體手把。SHALL 分開腳本支持證據與自然操作，保留未測装置／感官缺口；不同舊SHA的PASS不得拼接。每實作單元 MUST scope review、正負邊界tests、raw evidence、正式獨立APPROVED、具體merge授權及postmerge確認；advisory不冒充正式批准。發布另需授權。

#### Scenario: 只有 CI 或 Editor PASS
- **WHEN** 沒有凍結輸出包自然操作與必要感官／裝置證據
- **THEN** 完整整合NOT_RUN或INCOMPLETE，不標可發布。

#### Scenario: 工程驗收通過
- **WHEN** 同版本矩陣、正式審查、已授權合併與postmerge均齊備
- **THEN** 可登錄工程DONE，仍不自動上傳itch、部署或購買。

### Requirement: 每次交付的SPEC進度與完成判定

每次完成、受阻或交接回覆 MUST 報已完成項目數／22、百分比、本次完成項目、尚缺gate及下一個eligible步驟。百分比 SHALL 僅為task計數，不代表工程品質或工作量。MUST 保留原22項結構及未測狀態；只有全部必要同版測試PASS與全部review/merge/postmerge gate完成、22/22時才能稱SPEC completed。

#### Scenario: 文件或CI通過但遊戲驗收缺失
- **WHEN** OpenSpec格式、CI、方案或子步驟通過，但必要Player/自然操作/裝置/效能測項未跑
- **THEN** 不勾未完成task、不稱SPEC completed，回報目前計數與未完成項。

#### Scenario: 任一必要測試缺失或失敗
- **WHEN** 存在FAIL、UNKNOWN、SKIPPED、NOT_RUN或正式gate尚缺
- **THEN** 保持未完成，不以刪除測項或改判NOT_APPLICABLE取得22/22。

### Requirement: Unity與Jev最終實際驗收

E13 SHALL 可見打開凍結候選的指定Unity project並記錄Editor版本、project/code/profile/asset/full-build身份與操作證據；MUST 另驗收同版輸出Windows Player的完整S01–S08、四難度自然勝敗/重試/暫停/失焦、音效及實體手把。MUST 核對Jev的實際能力及使用者接受的執行語義，不把Choice advisory回應描述成Jev本身控制Unity。

使用者於2026-10-08確認Jev支援選擇、Unity/Player工具實際執行；2026-10-12 v2 SHALL 允許使用者人工executor執行可見Editor開啟及Player合法操作，agent負責CLI工程測試與版本／證據核對。SHALL 記錄去敏且充分的state、可用/合法候選、Choice/confidence、state新鮮度、採用/拒絕、實際工具或人類操作者、時間、命令/版本/操作、逐測項原始畫面／操作與結果及對應outcome。聲音與實體手把 MUST 由使用者實際驗收並記錄裝置；不得宣稱agent已感受聲音或操作實體手把。MUST 不以Jev信心、caller報告、口頭「玩過」、Editor開啟或CI代替完整同版矩陣。缺自動UI工具不單獨阻擋人工執行；缺實際executor或必要證據時 MUST 保持UNAVAILABLE／NOT_RUN。Jev不可用不得偽造Choice或outcome。

使用者產品體驗確認、agent技術advisory與具資格獨立審查者的正式exact-head APPROVED MUST 分列；MUST 遵守GitHub counted approval及branch protection，不以使用者自行合併、文件審查或U1歷史例外取代後續正式批准。

#### Scenario: 人工執行同版完整矩陣
- **WHEN** 使用者依v2清單操作凍結Editor／Player，逐項保存身分、時間、原始操作與結果，並有真實Jev Choice／outcome
- **THEN** 可作為5.2的實際驗收證據；仍須全部必要測項PASS，不以人工身分免除音效、實體手把、四難度及自然勝敗。

#### Scenario: 人工結果缺項或版本不符
- **WHEN** 只有口頭接受、部分測項、缺裝置／聲音證據，或操作版本與凍結候選不同
- **THEN** 相應測項保持NOT_RUN／UNVERIFIED，5.2不完成；產品接受也不構成正式GitHub批准。

#### Scenario: Jev建議與實際執行分開
- **WHEN** 使用者已接受Jev支援選擇模式且必要phase gate已齊
- **THEN** 由核對且獲授權的executor開啟Unity及執行合法操作，分別保存Jev與Editor/Player實測證據；全部必要矩陣同版PASS後才可完成5.2。

#### Scenario: Jev或Editor成功但沒有完整Player證據
- **WHEN** 只有Jev回應/狀態、Editor開啟或腳本trace，或executor不存在、輸出包版本不一致
- **THEN** 最終驗收保持BLOCKED/NOT_RUN，不宣稱遊戲已通過或SPEC completed。
