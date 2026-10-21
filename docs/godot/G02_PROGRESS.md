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
- Task8: IN_PROGRESS — README切Godot優先；準備freeze候選、export/headless startup證據與獨立full review。

## Rulings / diagnostics

- Task3: Ruling: golden clock使用整數stepNumerator=1、stepDenominator=60在Godot還原，而不是JSON浮點dt — precision-probe.log實測JSON_DT=.016666666666666659、原生1/60=.016666666666666666，造成101個採樣不合（player-green-1）；clock-ratio-red→green與player-green-2已驗證，未改招式邊界／擴容差。成本若判錯是時間契約不合，已由全部741案例約束。此問題修正輪1/2已用且GREEN。
- Task2/3 checkpoint合併保存，因共用gameplay測試聚合器；各自RED/GREEN原件仍分開，沒有把中途FAIL標PASS。
- Army coverage harness作用域問題：army-reactions-green-1在gameplay.gd:330解析失敗（外層frame與後加loop同名，並有arena同名）。分類TEST_FAILURE；比對既有工作區段後只改測試local名稱，修正輪1/2，green-2 PASS，模擬未動。
- Oracle strictness：檢視比較器發現array HP未套1e-4、離散numeric仍給1e-3、NaN可能漏拒；新增meta cases實際RED（3條失敗），僅收緊測試比較器，未放寬容差或改source規則。oracle-strictness-green合併1117/1117 PASS（含1021接線／規則、92 army/reaction採樣與4 comparer meta）。

## Native adapter rulings

- Godot pad使用原生語義enum：瀏覽器button4/5等數字不可直接搬用。鍵盤與pad軸分別讀取再相加／正規化，保留source deadzone與混合輸入；mapping有結構檢查，實體手把NOT_RUN。
- GUI按鈕開始／retry清暫存輸入，避免原生GUI點擊穿透；鍵盤J／Enter用同一start_battle流程但保留該frame合法輸入，合成KEY_J已驗證可開始並發N1。這是headless事件接線，不是Windows可見鍵盤操作證據。
- fallback姿態／尾跡只是模擬的read-only呈現，不靠它們決定命中；原GLB、骨架動作、完整特效與音畫仍另案。

## Evidence and limits

No browser/native focus attempts in G02. Prior Windows focus2+explicit1 attempts remain exhausted; previous extra Web run was successful but does not verify new gameplay. Product/rule tests are headless only until separately evidenced. No final art/GLB/audio/controller/performance/Jev/300KO-S acceptance claim, no push/PR/merge/deploy/paid/provider calls. No src/tests/public/package/lock/Unity edits. New unexpected issues follow existing two-round per-problem limit; expected TDD RED isn't a product repair round. Necessary independent source/code review remains due.
