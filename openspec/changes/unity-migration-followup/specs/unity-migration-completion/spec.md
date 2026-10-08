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

美術工程師 SHALL 負責趙雲來源、資產修復與匯出，遊戲工程 SHALL 負責 Unity runtime、量測、匯入和驗收。MUST 依 asset-collaboration 核對指定工程師、工作區、來源、傳輸資料與動作範圍；實際送達未知 MUST 保持 PREPARED_NOT_SENT。交付 MUST 使用新 delivery_id、來源／GLB hashes、技術 QA 與授權；不得覆蓋原資產。

#### Scenario: 只有需求草案
- **WHEN** 需求存在但沒有送達／接單證據
- **THEN** 不宣稱已委派、製作中或完成，獨立量測準備可繼續。

#### Scenario: 收到美術交付
- **WHEN** 新 GLB 與 manifest 到達
- **THEN** 只標 DELIVERED，核對 hashes／契約後進入 INTEGRATING，遊戲品質驗收通過前不標 ACCEPTED。

### Requirement: 既有預算下的量測能力恢復

E12 工程 MUST 重用既有候選與 runner，先提交新定位證據和受審查方案，保留兩輪已用 budget；不得重新命名來重新計數。MUST 精確辨識 counter category/name/unit、timestamp 時鐘與 UTC、Player 身分及高水位；必要數據缺失 SHALL 為 null／UNKNOWN。短 probe SHALL 僅支持能力結論。

#### Scenario: 時鐘或 counter 身分不正確
- **WHEN** VRAM timestamp 未符合原 freshness 或 draw counter 指向 UI Toolkit
- **THEN** 記 BLOCKED，禁止 formal benchmark；不得改窗口或將 unknown 填0。

#### Scenario: 能力測試通過
- **WHEN** 工具單元正負邊界 tests 與短 probe 通過
- **THEN** 只記該版本能力結果，不標 E12 DONE，不把3+10秒當30+180秒成績。

### Requirement: 正式量測前的共同前置條件

正式 benchmark MUST 先鎖定品質已驗收資產、code/profile/full build hashes、硬體及 Player readback、固定交戰／無雙／倒地 workload、camera-specific 真正可見數、前景／focus／minimized、CPU/GPU timing 的 frame identity／latency／去重／收尾，以及記憶體時間對齊和工具成本對照。MUST 分列 alive／engaged／attackers／frustum／visible；不得以視錐或背景窗口減負載代替可見場景。

#### Scenario: 美術等待期間
- **WHEN** 品質資產尚未交付，但工具可用佔位資產測能力
- **THEN** 允許能力工程證據，禁止正式品質／效能驗收結論。

#### Scenario: timing 或 visible 缺口
- **WHEN** 必要樣本未對齊或只有 frustum 數
- **THEN** 正式分級及 soak 保持 NOT_RUN／BLOCKED，不靜默捨棄缺樣。

### Requirement: 修復交付的整合品質 gate

資產與相關 runtime 修正 MUST 在同一整合單元完成 tests、雙引擎實際 render、自然操作、使用者視覺確認及 exact-candidate review 後才合併。SHALL 保留21骨命名／層級、17招式、4 influences、root-motion=false、tip/tipBase、FootPlant和可見載入fallback。MUST 在30/60/120Hz沿用握點p95≤3cm、plant≤5cm、扣除設計位移後root≤5cm；握點僅指定握持窗口，plant 排除設計滑步／擊退／空中，不能重訂原門檻。

#### Scenario: 資產技術 QA 通過但有拉伸
- **WHEN** 匯入正常而實際 idle／動作仍有尖三角、跨部位拉伸或抖動
- **THEN** 品質 FAIL，不合併、不作正式 E12 基線。

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

使用者於2026-10-08確認採Jev支援選擇、Unity/Player工具實際執行的模式。SHALL 記錄去敏且充分的state、可用/合法候選、Choice/confidence、state新鮮度、採用/拒絕、實際executor/命令/版本/操作、結果證據與對應outcome。MUST 不以Jev信心、caller報告、Editor開啟或CI代替實測PASS。缺該executor時，MUST 標UNAVAILABLE並保持最終驗收未完成。

#### Scenario: Jev建議與實際執行分開
- **WHEN** 使用者已接受Jev支援選擇模式且必要phase gate已齊
- **THEN** 由核對且獲授權的executor開啟Unity及執行合法操作，分別保存Jev與Editor/Player實測證據；全部必要矩陣同版PASS後才可完成5.2。

#### Scenario: Jev或Editor成功但沒有完整Player證據
- **WHEN** 只有Jev回應/狀態、Editor開啟或腳本trace，或executor不存在、輸出包版本不一致
- **THEN** 最終驗收保持BLOCKED/NOT_RUN，不宣稱遊戲已通過或SPEC completed。
