# G02 — Godot 原生可玩核心移植

狀態：獨立實作前審查ACCEPT_SCOPE（含R1修正）；實作進行中，非整體完成。Base `03e9c903027774f8fb7c8aad147204f6a7ab1d9b`，分支 `codex/godot-native-gameplay-20261021`，沿用既有隔離worktree；保留G01原分支及全部證據。

## 目標與依據

使用者重申要把遊戲移到Godot引擎開發，了解原生玩法優先、角色／鏡頭／戰鬥／關卡方向後明確要求「請繼續」。本階段從空場景改為Godot內可玩的核心，而非再做瀏覽器工具鏈QA。先SPEC、獨立Astra review再實作的既有要求沿用；不新增人工技術批准或復活已刪治理。

本次成功條件來自上述要求與目前原版source/tests：Godot主場景可從標題選四難度出陣，控制角色、17招／防禦／閃避／跳躍／無雙、300兵實際戰鬥、HP／氣／KO／連擊／時間HUD、暫停／失焦與勝敗重試。這是**玩法核心移植**；不是最終畫面、音效、手感、效能或Jev驗收完成。

## 契約與來源

- `src/combat/moves.ts`, `combo.ts`, `hitshape.ts`, `stamp.ts`：N1–N6、C1–C6、JA/JC/DASH/COUNTER/MUSOU，時長、cancel、hits、lunge、height、判定形狀及stamp語意。敵兵只保存最後一次接受的stamp：連續相同stamp抑制；另一stamp命中後，原stamp可再次命中。不得改成每窗／每目標歷史集合。
- `src/entities/player.ts`, `tests/player.test.ts`：run7.4、gravity30、jump10.5、dodge15/.42、buffer.45、parry.16、counter.72；守勢角度、chip輕25%／重45%、蓄力優先、無雙需求100、傷害／霸體／死亡及合法取消全部按source移植，不以動畫決定傷害。
- `src/entities/enemies.ts`, `core/spatial-hash.ts`, `core/math.ts`：SoA／Float32儲存、mulberry32 seed7、engagement、attack token、windup／strike／recover、浮空／倒地／起身／擊破，保留更新與碰撞順序。hash查詢按cell X遞增、cell Z遞增、cell內插入順序，不全域排序；nearest等距保留第一個query候選。只有engagement的距離排序保留原始id次序的穩定tie，不混用這兩種語意。
- `src/entities/battle.ts`, `battle-director.ts`, `dragon-strike.ts`, `core/difficulty.ts`：四難度、KO60/150/240壓力階段、命中停頓、龍頭真實撞擊與stamp節奏、combo2.4秒、充能、勝敗／slowmo／result。評級逐字義保留：勝且seconds<300且damage<400為S，否則<480為A等；沒有新增數值分數。最終Jev仍另驗win、實際KO300與S，不能用小測試場的S代替。
- `src/world/layout.ts`, `entities/castle-setup.ts`：同一份城池矩形供碰撞與Godot幾何使用；limit55、起點(0,0,42), facingPI、25隊×12=300、capacity320與原始spawns。
- `src/core/input.ts`, `view/camera-rig.ts`, `src/game.ts`：WASD/方向、J/左鍵普攻連發.18、K/右鍵蓄力優先並抑制連發.48、L無雙、Space跳、Shift閃、F守、Q/E鏡頭、滾輪縮放5.5–13、R回正、Esc/P暫停、Enter確認；標題／playing／paused／ended及2.4秒結果延遲、重試保留難度、失焦清緩衝。

## 架構與實作選擇（主控選擇，不冒充使用者逐項指定）

1. 保持Godot4.7.2、GDScript、Compatibility、現有雙平台preset與lock。新增真正的`scenes/game.tscn`作為main_scene；G01 bootstrap只留診斷用途，F5不再進空場景。
2. 從未修改的TS規則用既有Node22原生TypeScript stripping產生canonical JSON：17招、四難度、城池、300 spawns、壓力／蒼龍資料及來源hash。測試golden traces由原TS實際執行產生，**先於**新Godot規則實作。`--check`唯讀比對，不讓Godot程式產生自己的expected。
3. Godot `RefCounted`規則模組：共用math/rng/stamp/hash/arena、Player、Enemies、Dragon、Battle。主要欄位命名保持來源camelCase以減少映射歧義；敵軍以PackedFloat32Array等SoA保存。規則只收controls並出events，UI/動畫只讀模型。
4. Godot Node3D/Camera3D/Control提供原生玩法；固定physics tick60Hz，接受的step dt與原版數學相同，不加入時間倍率捷徑。MultiMesh呈現300兵；原生GUI標題、難度、HUD、暫停、結果／重試。鍵鼠與標準手把映射沿用來源（實體手把仍需人工驗）。
5. 本階段明確標示程序化fallback：人形／長槍、敵軍、城池方塊、命中白閃與龍頭軌跡；保留tip／tipBase命名。它不是原GLB／骨架／材質／招式姿勢／完整VFX／音效品質PASS；不修改、刪除或重製原資產。後續再移植原模型、演出、音效、完整鏡頭遮擋／cutaway與視覺效能，不用fallback冒充完成。
6. 無DOM、Three.js runtime嵌入Godot、WebView或新npm依賴；TS只作離線契約資料／golden來源。原版`src/`, `tests/`, `public/`, package/lock與Unity保持不動。

## 範圍與介面

可新增 `godot/ChangshanLongdan/core/{sim_math,arena,spatial_hash,player,enemies,dragon,battle}.gd`、`scripts/{game,game_input,game_view,camera_rig}.gd`、`scenes/game.tscn`、`data/reference.json`、`tests/{gameplay,reference_cases.json}.gd/json`及必要UID。可新增 `scripts/godot-reference.mjs`, `scripts/tests/godot-reference.node.mjs`。可更新project.godot、export_presets.cfg（把runtime data/*.json明列include_filter，兩平台皆納入；tests仍排除）、smoke.gd與runner/Node tests，使main_scene明確允許新game入口並收取合併後真實cases；不削弱hash、外部輸出、process、report gate。若game選單提供應用程式Quit，僅原生平台顯示；Web必須隱藏並由host關頁，不能只測舊bootstrap的Quit限制。可更新root README與docs/godot的G02 spec／plan／progress／操作指南，修正舊README失效的治理入口，不恢復舊檔。

介面：
- `SimMath.damp/dampAngle/smoothstep/sampleKeys/rng/next_stamp`依來源數學；`Arena.constrain(pos, radius)->Vector3`；SpatialHash insert/query/clear保留查詢順序。
- `Player.new(moves)`, `reset(x,z,facing)`, `queue(controls)`, `clearQueuedActions()`, `update(dt,controls,aim,arena)`, `takeHit(damage,heavy,x,z)`, `gainMusou(amount)`。
- `Enemies.new(capacity,seed,profile)`, `setPressure(profile,range,maxAttackers)`, `reset(spawns)`, `update(dt,px,py,pz,arena)`, `nearest(...)`, `applyHit(stamp,window,ax,ay,az,facing,out)`；維持公開SoA／kills／strikes。
- `Dragon.start/stop/update`與active/striking/headPos/stamp；`Battle.new(reference[,setup])`, `reset(difficulty)`, `interrupt()`, `step(realDt,controls)->float`, `result()->Dictionary`與唯讀呈現用途欄位。不提供UI cheat／clear／fill或改速入口。
- `GameInput.sample(dt)->Dictionary`, `clear()`；`CameraRig.snap/recenter/update/to_controls`；`GameView.update(battle,simDt)`不改戰鬥；`Game.start_battle/set_paused/tick`統一處理GUI與鍵盤。

## 必要驗證

- **先RED後GREEN**：新Node測試（canonical資料缺失／過期來源、17/300/4與golden來源）；Godot測試先證明缺核心／入口，再移植。保留每次原始輸出，TDD預期RED不冒充產品缺陷或重新計失敗額度。
- 固定golden與直接案例涵蓋連段N1–N6／N3→C4、JA/JC、dodge→DASH、guard/parry/chip/backhit/counter/death、無雙消耗與無敵、連續last-stamp抑制及交錯stamp重新接受（1,1,2,1→1,0,1,1），實際Player/Dragon/Player交錯trace、aim／高度／三形狀邊界、rng/hash／collision（含id0在(1,0)、id1在(-1,0)、半徑3的query=[1,0]與nearest=1）、seeded敵軍／tokens／四難度及constructor→首次start→retry的RNG持續性、龍頭stamp／終止、hitstop預輸入、combo／KO／勝敗／原rank邊界、300出生與layout、pause／失焦清鍵、重試難度與延遲結果、真實Game main與InputMap／按鈕接線。測試可直接推進／設fixture，但不得稱自然通關或Jev證據。
- 數值容差：Float32位置／SoA最高1e-3；狀態、事件種類／序列、HP／KO／次數等確定值按來源比較（HP來源Float32值容差1e-4）。不得擴大容差來吞真缺陷。
- 使用已存在runner與SceneTree報告；Node相關測試、canonical `--check`、Godot import/合併smoke+gameplay cases、必要型別／diff checks；原TS未改，不重跑不相關完整Web QA。不開瀏覽器、不調provider、付費、上傳、push／PR／merge或改動全域工具。
- Windows焦點原問題及既有已用額度原封保留，不能因G02／新branch重開。headless只證規則與匯入，**不冒充原生可見操作、手感、聲音、手把、效能或最終移植PASS**。可交付Godot工程供原生F5操作，視窗問題仍需操作者解除；不為此阻止已授權的獨立開發步驟。
- 實作前及完成後由未參與實作的唯讀Astra reviewer做架構／契約／風險審查；requested model不等於backend attestation。實作由主控單一writer，沿用獨立worktree，無新的人工技術gate。新缺陷每問題最多兩輪診斷修正；既有問題額度不重設。

## 不宣稱的完成項目

G02完成也不等於完整Godot移植、原角色ready、最終美術／音效／視覺效能、原生人工驗收或兩平台Jev300KO/S。原Three.js是對照，不再以其頁面開發或空場景網頁QA取代本次目標。
