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
- Task2: IN_PROGRESS — math/rng/hash/arena/hitshape and first Godot tests。
- Task3: pending — Player complete state machine。
- Task4: pending — enemy SoA/AI/hit reactions。
- Task5: pending — dragon/battle/outcomes。
- Task6: pending — input/camera/procedural fallback。
- Task7: pending — actual main game scene/GUI/runner integration。
- Task8: pending — native instructions and independent final review。

## Evidence and limits

No browser/native focus attempts in G02. Prior Windows focus2+explicit1 attempts remain exhausted; previous extra Web run was successful but does not verify new gameplay. Product/rule tests are headless only until separately evidenced. No final art/GLB/audio/controller/performance/Jev/300KO-S acceptance claim, no push/PR/merge/deploy/paid/provider calls. No src/tests/public/package/lock/Unity edits. New unexpected issues follow existing two-round per-problem limit; expected TDD RED isn't a product repair round. Necessary independent source/code review remains due.
