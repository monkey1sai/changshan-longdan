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

MUST 依 G00→G01→G02→G03→G04，每期 scope review、適用正負邊界 tests、raw evidence、exact-head 適用正式獨立核准、具體 merge 授權、遠端 merge、post-merge 相容性與本任務 worktree 清理才 DONE 及開始下一期實作。MUST 保留同一問題已用修正額度，兩輪未成功即停；新範圍須獨立審查，不按工具／分支重設。G00 文件不承諾 runtime render，但 MUST 記為 NOT_RUN 並取得文件範圍審查，不能轉成產品 PASS。

適用正式核准 MUST 先依 [政策路由](../../../../../docs/governance/INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_POLICY.md)核對生效與scope。該政策目前是 `ADOPTION_CANDIDATE_NOT_EFFECTIVE`：未合法啟用、超出scope或activation不可驗證時，原正式APPROVED要求仍有效，缺項HELD。只有依當時有效規則合法啟用且在明確scope內，才允許獨立精確版本審查接受＋人類owner精確核准作為該範圍載體；MUST 分列GitHub實際review，不以owner／advisory偽填APPROVED。實質獨立性、較嚴平台規則及必要獨立人類／專項批准仍適用；本候選不能批准自身或回填歷史核准。

G04 SHALL 凍結同一 code/profile/asset/full-build，Windows 與 Web 各執行完整 S01–S08，保留四難度、自然勝敗、重試／暫停／失焦、聽感與實體手把證據；可見開啟指定 Godot project 並驗輸出包。最終驗收 MUST 使用下述「Jev-led natural victory at highest existing rank」流程，記錄去敏 state／合法 Choice／實際 executor／outcome，確認可用性及傳輸／呼叫授權；Choice、CI、Editor 或腳本不是自然操作／APPROVED。MUST 不繼續要求開 Unity 或默認可外傳 state。發布另授權。

#### Scenario: Direction is approved but formal gate is absent
- **WHEN** 使用者同意設計或 advisory 接受但適用正式核准／merge 尚缺
- **THEN** 本期保持 AWAITING_REVIEW/BLOCKED，不自批、不開始下一期 runtime。

#### Scenario: Final report combines different candidates
- **WHEN** CI、影片、資產或平台包不屬同一凍結版本
- **THEN** 完整驗收 INCOMPLETE，重驗受影響項，不拼接舊 PASS。

### Requirement: Jev-led natural victory at highest existing rank

移植成功 MUST 另有 Jev AI 主導的自然破關最高成績證據：Windows 與 Web 各至少一場，使用同一凍結 code/profile/assets 並分別識別實際完整輸出包。沿用 `src/entities/battle.ts` 的既有最高 **S 評級**，不是新增數值總分或追求未定義的理論最高連擊。每場 MUST 同時符合 `win=true`、實際 `ko=300`、`rank=S`、battle `seconds < 300`、`damage < 400`；rank函式本身不檢查KO，因此300KO SHALL 獨立核對。不得改評分、傷害、敵數或難度參數迎合驗收。

正式執行前 MUST 鎖定可審 protocol：各平台難度／seed／有效設定與完整package hashes、計分來源與battle-time語義、model/helper/executor版本及來源、觀察／動作時限與freshness、前景／focus、合法動作清單、所有請求／token／花費／attempt與停止預算。觀察期間合法暫停若被採用 SHALL 事先記明，battle time、實際wall time與暫停時段分列，不能改timeScale、竄改時鐘或把暫停未計入battle time冒稱連續實玩。這兩場S測試不替代或縮減原四難度／S01–S08矩陣，也不默認要求每一難度各一場S；所選難度／seed由跑前protocol明確核准，未定不得跑後補選通過條件。

Jev MUST 以獲授權且僅含遊戲的最新可見截圖／UI觀察選擇固定有界合法動作，由已驗證executor映射為正常鍵鼠／手把輸入。執行前重核state／focus／版本／授權，執行後取得真實readback；Choice只作決策，不是執行器、結果裁判或審查批准，confidence不得作勝利證明。MUST 禁止DEV/debug hooks、狀態／health／musou注入、強制清場、timeScale作弊、改分、傳送及隱藏狀態餵模型；不得以人工代打／救場或主控自行替換Jev戰鬥決策完成。人類純setup協助須跑前限定並另記，不能當Jev遊玩輸入。

每場 MUST 保存可存取的完整有序 frame／observation／decision／execution／outcome鏈、連續session影片（含暫停／setup時段）、正常結算勝利與300KO／S／time／damage讀回及畫面、stdout/stderr／失敗attempt、凍結版本／full-build及證據hashes、模型/helper/executor身分與實際請求用量／費用。確定性rank與完成條件由程式／證據核對，不由Jev聲稱PASS；精確邊界與防作弊判定必須有正負測試。缺鏈、陳舊截圖、不同包、executor不可用、provider錯誤、預算用盡、敗北或非S不得標最終完成。

SHALL 優先重用 `scripts/jev-vision-player.py` 與其已記錄 `jev-1.14.0` 模型契約，但在eligible階段重新驗證Godot／Windows及Web能力，不假設Web executor已能操作Godot。MUST 另外取得provider使用、遊戲影像傳送與具體cost/attempt預算授權；本SPEC不立即授權呼叫、付費或讀取／輸出credentials。沿用既有失敗及實際已用預算，同一驗收任務跨平台、工具、目錄與resume不可重設；新的獨立任務預算需跑前明確核准。舊Three.js S紀錄僅供方法參考，不能借作Godot PASS。未執行保持NOT_RUN，能力／必要證據或門檻缺失保持BLOCKED；其他品質／效能／人工視聽、正式核准、merge／post-merge及階段順序仍須完成，Jev勝利不能取代。

#### Scenario: Both platform packages reach the highest existing rank
- **WHEN** 凍結同版的Windows及Web各完成Jev合法輸入自然勝利，兩場均300KO、S、battle秒數小於300、受傷小於400，且所有protocol／身份／證據鏈與其他必要gate可核對
- **THEN** 只將此新增Jev最高評級驗收標PASS；仍須其餘完整矩陣及交付gates才可稱移植成功。

#### Scenario: Strict rank boundary or missing population outcome
- **WHEN** 任何一場時間等於300秒、受傷等於400、實際KO不是300、未自然勝利或結算不是S
- **THEN** 該場不通過；不四捨五入或變更評分門檻，不單憑顯示S或Jevconfidence接受。

#### Scenario: Hidden-state or human-assisted victory
- **WHEN** 使用DEV注入／debug清場／timeScale作弊／隱藏資料觀察，或有人類戰鬥代打／替換Jev決策
- **THEN** 本驗收拒絕該場，即使顯示勝利與S亦不採計；保留該attempt及違規證據，不重置預算。

#### Scenario: One platform or evidence chain is incomplete
- **WHEN** 只有Windows或Web通過，或影片／決策／執行／結算鏈缺失、身份／hash不符、observation過期或executor未驗證
- **THEN** 新增最終gate保持未通過，不以舊Three.js、另一平台或其他SHA結果補齊。

#### Scenario: Provider or budget stops the run
- **WHEN** provider／工具不可用、授權不齊、usage不可信或任何既定停止預算到達
- **THEN** 停止自動操作並保存失敗／未完成證據；按protocol安全暫停或結束，不人工救場／自動加額／換目錄續跑，最終驗收保持BLOCKED或NOT_RUN而非PASS。

### Requirement: Progress reports distinguish planning and product completion

每次交付 MUST 回報本 change 已勾數／tasks 總數、task 計數百分比、本次內容、缺口及下個 eligible 步驟。只有每項約定條件完成才勾，不因 artifacts complete、單一測試或方案批准勾產品驗收。舊 Unity 計數 SHALL 僅作歷史；只有同版全部必要 gates 通過才稱 Godot 移植完成。

#### Scenario: Only G00 documents exist
- **WHEN** SPEC／ADR／計畫已寫但正式 gates 或 runtime 尚缺
- **THEN** 明示僅規劃及當前 task 計數，不能稱 Godot 可玩版、雙平台基礎或遷移已完成。
