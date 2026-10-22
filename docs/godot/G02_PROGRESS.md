# SDD ledger — plan: docs/godot/G02_PLAN.md

Goal: Godot原生玩法核心（17招、300兵、四難度、戰鬥／勝敗／重試），不再做空場景網頁QA。Spec: G02_SPEC.md；base03e9c903027774f8fb7c8aad147204f6a7ab1d9b。隔離worktree沿用，分支codex/godot-native-gameplay-20261021；G01分支保留。

Preimplementation: Astra reviewer94a8d22f及follow-up281b32f5 ACCEPT_SCOPE。requested名稱不等於backend attestation；report與原始證據在C:/Repos/changshan-longdan-godot-evidence/g02-20261021-native/。兩項規格修正已實際用舊TS驗證：hash query=[1,0]/nearest1，last-stamp交錯1,1,2,1命中[1,0,1,1]；Player/Dragon/Player命中[1,1,1]。不更改原規則。

## Pre-flight interfaces
- Tasks1→2/3/4/5: reference.json preserves camelCase keys, moves/profiles/layout/spawns/dragon; reference_cases.json source-only expected, no Godot-generated oracle。
- Tasks2→3/4: arena returns constrained Vector3 (immutable value type vs old mutable point); callers must assign returned value. Ruling: use return value explicitly — matches Godot value semantics — cost if wrong is collision failure pinned by arena tests。
- Tasks3/4→5: Player.events/activeHits, Enemies SoA/kills/strikes preserve source call order and shared stamp stream; single-last-stamp suppression, no history set。
- Tasks5/6→7: Game title/playing/paused/ended owns mode, real Godot input feeds PlayerControls, view reads simulation only. Native Quit never exposed on Web。

## Tasks
- Task1: complete — Node4/4 GREEN after missing exporter RED; source --write/--check PASS; runtime17 moves/4 profiles/300spawns/capacity320 and13 player source traces generated BEFORE Godot rule implementation. Originals untouched. Evidence reference-red.log/reference-green.log。Canonical fixtures are unit evidence, not natural wins/Jev。
- Task2: complete — math/rng/hash/arena/hitshape；math-red為缺3模組，math-green實際Godot45/45 PASS。
- Task3: complete — Player完整狀態機，舊TS對照擴為18情境涵蓋全部17招；player-red缺模組，player-green-2合併Godot741/741 PASS。
- Task4: complete — Enemy SoA/AI/四難度seeded traces、nearest格網順序與last-stamp交錯；enemies-red缺模組，enemies-green-1 Godot817/817 PASS。後補source-only五種反應／captain armor分支與四難度300兵near/far traces，包含54交戰上限／最低20行軍；army-reference-red→green，army-reactions-green-2合併1113/1113 PASS，未修改既有Godot模擬或原TS。
- Task5: complete — Dragon軌跡、Battle/pressure/hitstop/combo/KO/原rank、constructor/start/retry RNG與Player/Dragon交錯；battle-red缺兩模組，battle-green-1 979/979，補直接邊界後battle-edges-green合併991/991 PASS。fixture小場勝利不算自然300KO/S。
- Task6: complete — NativeInput鍵鼠／語義手把映射、following Camera3D、共用layout城池、fallback人形／tip／tipBase、320容量MultiMesh和龍頭尾跡；adapters-red→adapters-green-1 PASS。
- Task7: complete（source/headless）— F5改為game.tscn；四難度開始、HUD、暫停／失焦清pending、結果延遲／重試、Web隱藏Quit。runner只新增game明確allowlist與雙preset runtime JSON門檻，既有保護不放寬。entry-red→entry-green-1 1020/1020，Input.parse_input_event連通後native-key-green 1021/1021 PASS；Node22/22 PASS。未做可見前台驗收。
- Task8: IN_REVIEW — 9fe4bb3歷史候選為1138/1140、獨立BLOCK；使用者「修完後合併」已增授F1一輪（總額3輪，不重置前2輪）。R3只讓全模式release送達、press仍限playing；保留舊回歸並補victory/defeat、結果顯示前後、路由Enter retry、J hold與quick-click。pr56-f1-r3/red為1145/1155（10條預期FAIL），同一最小修正後green為1155/1155、stderr空。待新凍結候選匯出、exact-head獨立複審／CI後正常合併；不宣稱整體移植／可見驗收完成。

## Rulings / diagnostics

- Task3: Ruling: golden clock使用整數stepNumerator=1、stepDenominator=60在Godot還原，而不是JSON浮點dt — precision-probe.log實測JSON_DT=.016666666666666659、原生1/60=.016666666666666666，造成101個採樣不合（player-green-1）；clock-ratio-red→green與player-green-2已驗證，未改招式邊界／擴容差。成本若判錯是時間契約不合，已由全部741案例約束。此問題修正輪1/2已用且GREEN。
- Task2/3 checkpoint合併保存，因共用gameplay測試聚合器；各自RED/GREEN原件仍分開，沒有把中途FAIL標PASS。
- Army coverage harness作用域問題：army-reactions-green-1在gameplay.gd:330解析失敗（外層frame與後加loop同名，並有arena同名）。分類TEST_FAILURE；比對既有工作區段後只改測試local名稱，修正輪1/2，green-2 PASS，模擬未動。
- Oracle strictness：檢視比較器發現array HP未套1e-4、離散numeric仍給1e-3、NaN可能漏拒；新增meta cases實際RED（3條失敗），僅收緊測試比較器，未放寬容差或改source規則。oracle-strictness-green合併1117/1117 PASS（含1021接線／規則、92 army/reaction採樣與4 comparer meta）。

## Independent review and corrective budget

- Full reviewer 4abfe9cd（requested Astra/high）檢視61520b4，report final-review-61520b4.md：F1 P1標題GUI滑鼠可被全域poll誤當開戰；F2 P2 RB/RT先OR再取edge；F3 P2同frame重用InputEvent。未宣稱獨立重跑或可見驗收。
- F1 round1/2：先實際RED，分離cld_mouse_*與鍵盤poll、只接受playing mouse press，clear重置mouseAttack。持按不開戰已改善，但GUI release三項仍FAIL。獨立診斷7dfc1400與f1-independent-diagnosis-r1.md指出headless物理64x64對UI960x540的座標錯用。
- F1 round2/2：f1-transform-probe實測final transform把(480,299)轉(32,33.93333)，GUI回傳logical(480,299)、local(228,19)並正常button_down/up/start。只改測試helper作轉換並斷言實際按鈕收到press；f1-mouse-green-r2 PASS。兩輪不得藉問題改名重置。
- F2：poll_pad在production sample使用，先分別保留RB/RT物理edge再合併動作；f2-pad-red→green，兩組重疊／保持／再次按下共12個edge案例。實體手把仍NOT_RUN。
- F3：f3-warning-red確認既有warning；release改成獨立InputEventKey，f3-warning-green為1138/1138、stderr空白。
- 後補F1 lifecycle回歸重現：playing按住後進入ended，再放開；Game._input忽略ended mouse-up，keyboard retry(false)會重播殘留hold。ended-mouse-release-red實際1138/1140（ended_mouse_release_does_not_repeat、keyboard_retry_has_no_released_mouse_ghost失敗）。未再修產品；F1修復2/2已用盡，需新增明確額度。此fixture不是自然勝利證據。獨立診斷e3030e69已確認有效產品lifecycle回歸（f1-lifecycle-independent-diagnosis.md），建議全模式接收release但僅playing接收press；不是額外修正授權。無新增前台／browser操作。

## PR56 F1 third round — explicitly authorized

- 使用者「修完後合併」回應額外一輪請求，僅增授F1 round3，原2輪保留；目前3/3已用、GREEN，若需第四輪必須再獲明確授權。已沿用e3030e69診斷與PR exact-head reviewer3aa9bf8f的來源證據，不另建技術批准流程。
- 原C:/Repos/changshan-longdan-godot-g01已按授權安全封存清理，branch／commits／完整ZIP與bundle保留。本輪由Pi用普通git worktree add建立C:/Repos/changshan-longdan-godot-pr56-fix，沿用同一PR branch；非Codex App-managed。只恢復已驗原依賴為一般檔案，不新增npm依賴或連結。
- game.gd既有_input seam只轉送所有模式的mouse-button release，press仍限制playing，非mouse行為不變。不恢復全域mouse polling、不在keyboard retry粗暴clear所有合法輸入、不改傷害／評級／容差。實際RED→GREEN與命令證據在外部pr56-f1-r3/。
- Native foreground2+1仍耗盡、沒有browser／前台新增操作；fixture lifecycle與合成Enter不是自然通關證據。exact-head review、CI、merge與cleanup回執由外部handoff保存，與目前來源freeze進度分開。

## Native adapter rulings

- Godot pad使用原生語義enum：瀏覽器button4/5等數字不可直接搬用。鍵盤與pad軸分別讀取再相加／正規化，保留source deadzone與混合輸入；mapping有結構檢查，實體手把NOT_RUN。
- GUI按鈕開始／retry清暫存輸入，避免原生GUI點擊穿透；鍵盤J／Enter用同一start_battle流程但保留該frame合法輸入，合成KEY_J已驗證可開始並發N1。這是headless事件接線，不是Windows可見鍵盤操作證據。
- fallback姿態／尾跡只是模擬的read-only呈現，不靠它們決定命中；原GLB、骨架動作、完整特效與音畫仍另案。

## GitHub checkpoint authorization

使用者新增要求：commit、open PR、check CI、merge、clear worktree。授權目的地為monkey1sai/changshan-longdan、head codex/godot-native-gameplay-20261021、base main；本任務local worktree C:/Repos/changshan-longdan-godot-g01。先誠實保存WIP與兩條RED回歸；該舊候選為BLOCK。PR後來已由外部轉為Ready（本session未更改其Ready狀態），不等於品質通過；本輪依使用者增授修正後重驗／複審／CI才可合併。既有Game CI只驗舊Web，不取代Godot1140回歸或必要獨立審查。先前Git操作授權本身未增加F1額度；本輪「修完後合併」另明確增授一輪，但不解除merge gate，也不授權部署／保護繞過／遠端branch刪除。清理只在已合併或成果保全、無使用且獨立確認不再需要時執行；未合併branch／commits保留。Authorization Envelope與GitHub操作回執在外部pr-checkpoint-20261021/。

## Evidence and limits

No browser/native focus attempts in G02. Prior Windows focus2+explicit1 attempts remain exhausted; previous extra Web run was successful but does not verify new gameplay. Product/rule tests are headless only until separately evidenced. No final art/GLB/audio/controller/performance/Jev/300KO-S acceptance claim, 此前沒有push/PR/merge/deploy；本次新增GitHub操作僅依上述checkpoint授權，無deploy／paid／Jev provider calls。 No src/tests/public/package/lock/Unity edits. New unexpected issues follow existing two-round per-problem limit; expected TDD RED isn't a product repair round. Necessary independent source/code review remains due.
