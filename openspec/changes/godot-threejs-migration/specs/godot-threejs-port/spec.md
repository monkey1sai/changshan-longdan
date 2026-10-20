## ADDED Requirements

### Requirement: Godot replaces Unity without erasing source history

新引擎開發 MUST 直接移植 Three.js／TypeScript 基準 `034e27052f02967d55241abae80659f2c64ded78` 至 Godot，而非繼續 Unity 或轉譯 Unity 工程。MUST 保留原 Web source／package/lock／發布紀錄、Unity 工程與未完成證據；舊 Unity 3/22 不得改勾為完成或當作 Godot 進度。使用者設計同意、advisory、formal APPROVED、merge SHALL 分列。

#### Scenario: New work is selected
- **WHEN** 主控選擇新的引擎實作步驟
- **THEN** 依 G00–G04 的第一個 eligible 步驟執行，不恢復 Unity E12 或要求先完成舊 Unity 待辦，亦不繼承其 PASS。

#### Scenario: Engine changes but known failures remain
- **WHEN** 遇到歷史蒙皮形變或量測缺口
- **THEN** 保存失敗來源及已用額度，不因換引擎宣稱修復或重開同一問題的兩輪額度。

### Requirement: One Godot source delivers Windows and Web

系統 SHALL 使用 GDScript、Compatibility renderer、single-thread Web，同一 code/profile/assets 輸出 Windows x64 完整包及 Web／itch.io HTML5 ZIP。G01 MUST 鎖官方 executable/templates 精確版本、來源與 hashes，完成實際 import、測試、兩平台 export 及可見啟動。缺 executable、錯版／缺 templates、失敗 exit、timeout、過期／缺少報告及零測試 MUST fail closed。

#### Scenario: CLI exists but templates are missing
- **WHEN** 本機可回傳 Godot 版本而無匹配 export templates
- **THEN** 僅記 CLI 可用，export 保持 NOT_RUN/BLOCKED，不自行下載或標工具鏈通過。

#### Scenario: Both exports are produced
- **WHEN** 同版 Windows 包與 Web ZIP 建立
- **THEN** 各保存完整 payload hashes／logs／啟動結果，空場景只證明 G01 而非可玩移植完成。

### Requirement: Gameplay rules and timing match the source

系統 MUST 保留 N1–N6、C1–C6、JA、JC、DASH、COUNTER、MUSOU，四難度、原移動／取消／命中／受擊／AI／Director／勝敗規則。MUST 分離規則及呈現事件，保留 controller 單一位移權威、meter/second/radian、RNG 語義與 hit-stop/input/game/animation 時鐘。MUST 用原 TS fixture 語義及 30/60/120Hz 正負邊界驗證；attackInstance×hitWindow×enemy 每 window 最多一次傷害，同 tick hit-stop 取 max 而非按目標相加。原候選 profile SHALL 保持未接 runtime，除非另經明確審查。

#### Scenario: Same hit reaches one or twenty soldiers
- **WHEN** 同招式合法命中 1／5／20 人或多個 hit windows
- **THEN** 各 window 正確去重、多段不被誤刪、停頓不乘人數，距離／高度／角度負例不命中。

#### Scenario: Input arrives during hit-stop or pause
- **WHEN** 早按連段、停頓中輸入或失焦後恢復
- **THEN** 緩衝／消耗符合來源、恢復不誤出招，並保存不同更新頻率的 state/move/hit trace；不靠改 golden 隱藏差異。

### Requirement: Preserve character and presentation quality

MUST 保留既有趙雲 GLB／manifest／來源及 tip/tipBase、21 骨／4 influences 契約，Godot adapter 驗座標、骨架及程序動作；不得擅自重生素材。S03 MUST 在指定握持／plant 窗口以 30/60/120Hz 驗握點 p95≤3cm、plant slip≤5cm、扣除設計位移的 root jump≤5cm。來源缺失、解碼錯、骨架錯、材質缺失與重新載入 SHALL 有可見可玩 fallback，新模型 ready 前不隱藏舊模型。MUST 以 Godot 真實 render／連續動作及使用者確認驗證 UI、鏡頭／cutaway、VFX、程序士兵與城池、音效／音樂；資產修復走協作契約。

#### Scenario: Import succeeds but visible deformation persists
- **WHEN** GLB 正常匯入而動作有拉伸／抖動／槍脫手
- **THEN** 品質 FAIL，不以 import 成功、fallback 或更換引擎標 S03/S07 PASS。

#### Scenario: Asset load fails
- **WHEN** 缺檔、解碼失敗、骨架／材質不合契約
- **THEN** 錯誤可追溯且 fallback 可見可玩，保存失敗案例與真實畫面。

### Requirement: Web delivery works inside an iframe

Web MUST 以 index.html 匯出並保留生成檔名，在子路徑／iframe 驗證相對載入、WASM MIME、WebGL2、focus／pointer capture、音效首次互動解鎖、全螢幕、storage 拒絕及背景切回。兩平台 MUST 有中英 UI、鍵鼠及實體手把、三出陣入口、四難度、暫停／失焦、自然勝敗及重試。MUST 保留原 Three.js itch 交付直到獲准替換；本地 iframe 支持證據不得標成已上傳 itch。

#### Scenario: Browser storage or audio activation is unavailable
- **WHEN** iframe 拒絕 storage 或尚無首次使用者互動
- **THEN** 遊戲不崩潰，不把 storage 視為存檔成功，不將被阻擋音效視為已實聽通過。

#### Scenario: Windows works but browser fails
- **WHEN** Windows 自然遊玩通過而 Web 載入／輸入／音訊有失敗
- **THEN** 雙平台交付保持未完成，不借 Windows 證據替代 Web。

### Requirement: Retain graded performance thresholds and measurement integrity

G04 MUST 先審查各平台量測來源／單位／成本、CPU/GPU frame identity／latency／去重／收尾、前景/focus/minimized、記憶體對齊及四數 alive/visible/engaged/attackers，另列 frustum；MultiMesh batch 或視錐數不是 pixel-visible。必要來源缺失 MUST UNKNOWN/BLOCKED，不填零、不拿別平台值替代。非 .NET allocation／Web GPU/VRAM mapping 未正式接受前不得聲稱原 gate 通過。

MUST 在 1920×1080、renderScale1 逐級 20/50/100/200/300，每級 seeds7/11/23，各暖機30s＋採樣180s，全部通過才晉級，再 30min soak；CPU active/GPU 各 p95≤16.67ms、wall p99≤25ms、>50ms fraction≤0.001，nearest-rank 不先四捨五入、CPU/GPU 不相加。沿用 Private Bytes≤4GiB、dedicated VRAM≤2GiB；soak 首尾完整60s中位數 drift：Private≤max(64MiB,5%)、GCused 對等指標≤max(16MiB,5%)、VRAM≤max(32MiB,5%)；最後20min每分鐘中位數 slope 各≤1／0.5／0.5MiB/min。未知或改契約 MUST 先審查及人類批准，不跑完再降門檻。

#### Scenario: A population stage has missing metrics
- **WHEN** 某 seed 的可見數或必要 timing/memory 來源未證明、缺樣或過門檻
- **THEN** 保存 raw 並停止升級，不以 20 人／背景窗口／較低品質結果代表 300 人通過。

#### Scenario: Short capability probe succeeds
- **WHEN** 短 probe 或 profiler 顯示正常
- **THEN** 只記該版本能力結果，不替代正式分級／soak 或宣稱 1080p60。

### Requirement: Phase gates and same-version final acceptance

MUST 依 G00→G01→G02→G03→G04，每期 scope review、適用正負邊界 tests、raw evidence、exact-head 正式獨立 APPROVED、具體 merge 授權、遠端 merge、post-merge 相容性與本任務 worktree 清理才 DONE 及開始下一期實作。MUST 保留同一問題已用修正額度，兩輪未成功即停；新範圍須獨立審查，不按工具／分支重設。G00 文件不承諾 runtime render，但 MUST 記為 NOT_RUN 並取得文件範圍審查，不能轉成產品 PASS。

G04 SHALL 凍結同一 code/profile/asset/full-build，Windows 與 Web 各執行完整 S01–S08，保留四難度、自然勝敗、重試／暫停／失焦、聽感與實體手把證據；可見開啟指定 Godot project 並驗輸出包。若沿用歷史 Jev 支援流程，MUST 記錄去敏 state／合法 Choice／實際 executor／outcome，確認可用性及傳輸／呼叫授權；Choice、CI、Editor 或腳本不是自然操作／APPROVED。MUST 不繼續要求開 Unity 或默認可外傳 state。發布另授權。

#### Scenario: Direction is approved but formal gate is absent
- **WHEN** 使用者同意設計或 advisory 接受但 formal APPROVED／merge 尚缺
- **THEN** 本期保持 AWAITING_REVIEW/BLOCKED，不自批、不開始下一期 runtime。

#### Scenario: Final report combines different candidates
- **WHEN** CI、影片、資產或平台包不屬同一凍結版本
- **THEN** 完整驗收 INCOMPLETE，重驗受影響項，不拼接舊 PASS。

### Requirement: Progress reports distinguish planning and product completion

每次交付 MUST 回報本 change 已勾數／tasks 總數、task 計數百分比、本次內容、缺口及下個 eligible 步驟。只有每項約定條件完成才勾，不因 artifacts complete、單一測試或方案批准勾產品驗收。舊 Unity 計數 SHALL 僅作歷史；只有同版全部必要 gates 通過才稱 Godot 移植完成。

#### Scenario: Only G00 documents exist
- **WHEN** SPEC／ADR／計畫已寫但正式 gates 或 runtime 尚缺
- **THEN** 明示僅規劃及當前 task 計數，不能稱 Godot 可玩版、雙平台基礎或遷移已完成。
