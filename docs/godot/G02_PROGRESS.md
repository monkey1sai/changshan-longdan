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
- Task4: complete — Enemy SoA/AI/四難度seeded traces、nearest格網順序與last-stamp交錯；enemies-red缺模組，enemies-green-1 Godot817/817 PASS。
- Task5: complete — Dragon軌跡、Battle/pressure/hitstop/combo/KO/原rank、constructor/start/retry RNG與Player/Dragon交錯；battle-red缺兩模組，battle-green-1 979/979，補直接邊界後battle-edges-green合併991/991 PASS。fixture小場勝利不算自然300KO/S。
- Task6: IN_PROGRESS — input/camera/procedural fallback。
- Task7: pending — actual main game scene/GUI/runner integration。
- Task8: pending — native instructions and independent final review。

## Rulings / diagnostics

- Task3: Ruling: golden clock使用整數stepNumerator=1、stepDenominator=60在Godot還原，而不是JSON浮點dt — precision-probe.log實測JSON_DT=.016666666666666659、原生1/60=.016666666666666666，造成101個採樣不合（player-green-1）；clock-ratio-red→green與player-green-2已驗證，未改招式邊界／擴容差。成本若判錯是時間契約不合，已由全部741案例約束。此問題修正輪1/2已用且GREEN。
- Task2/3 checkpoint合併保存，因共用gameplay測試聚合器；各自RED/GREEN原件仍分開，沒有把中途FAIL標PASS。

## Evidence and limits

No browser/native focus attempts in G02. Prior Windows focus2+explicit1 attempts remain exhausted; previous extra Web run was successful but does not verify new gameplay. Product/rule tests are headless only until separately evidenced. No final art/GLB/audio/controller/performance/Jev/300KO-S acceptance claim, no push/PR/merge/deploy/paid/provider calls. No src/tests/public/package/lock/Unity edits. New unexpected issues follow existing two-round per-problem limit; expected TDD RED isn't a product repair round. Necessary independent source/code review remains due.
