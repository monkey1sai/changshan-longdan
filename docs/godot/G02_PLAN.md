# Godot Native Gameplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 主控單一writer直接實作，獨立reviewer不寫產品；沿用既有授權，不另問執行方式。

**Goal:** 將現有Three.js規則移進Godot真正主場景，300兵／17招／四難度可從原生選單操作戰鬥及重試，不再只運行空場景。

**Architecture:** 原TS產生不可由新Godot程式回寫expected的canonical JSON與golden traces；GDScript RefCounted模組移植規則，Node3D／Camera3D／MultiMesh／Control只負責呈現與輸入。保持原world coordinates、SoA Float32、seed與event/update順序；程序化fallback清楚標示，不算最終角色或畫面驗收。

**Tech Stack:** Godot4.7.2 GDScript Compatibility、既有Node22 TypeScript stripping、既有Three.js（只離線reference）、Node built-ins及Godot SceneTree tests；不新增dependencies。

**Spec:** `docs/godot/G02_SPEC.md`

## Global Constraints

- Base03e9c903027774f8fb7c8aad147204f6a7ab1d9b；原src/tests/public/package/lock/Unity不動，G01分支保留；本worktree已隔離，不再新建樹。
- 17招、300 spawns、四難度與原rank規則不改；使用同一份layout作render/collision，無standalone分數、UI cheat／fill／clear／timescale。
- Golden必須來自舊TS實際執行，不用新Godot程式產expected；Float32最高1e-3（HP1e-4），不得為失敗擴容差。
- stdout/stderr/exit、fresh run/candidate及payload/hash gates不放寬；raw evidence只寫新repo外路徑。
- Windows焦點舊問題額度已用盡，不因新phase重試；不開瀏覽器；實際可見、人耳／手把／效能、原資產ready與Jev自然300KO/S皆另行列證，不由headless替代。
- 技術SPEC／架構與最後code/evidence獨立Astra review；requested≠backend attestation。無push/PR/merge/deploy/provider或付費操作。

## Review Focus

1. Float32、rng unsigned multiply／hash cell/insertion順序、nearest等距首候選與engagement的穩定id tie會造成跨語言AI漂移：Tasks2/4用來源seed/相鄰pair traces約束。
2. 長招buffer、hitstop／pause／focus持鍵不能吃鍵或自動補招：Tasks3/5/6真實queue與輸入清除測試。
3. 單last-stamp的連續抑制／交錯重擊、無雙龍與本體使用不同stamp，死亡後不復活／重複KO：Tasks3–5跨窗、龍頭間隔、致死chip及kill消費測試。
4. 主入口必須是可玩game，不是只測診斷bootstrap；選單與結果重試走同一方法、保留難度：Tasks6/7實際PackedScene／按鈕／InputMap接線測試。
5. 規則成功不能冒充fallback已是原模型／原生可見PASS：Task8資料／呈現／runtime／最終遷移狀態分開，README帶原生F5與明確缺口。

## Task 1: Source-backed canonical data and traces

**Files:** create `scripts/godot-reference.mjs`, `scripts/tests/godot-reference.node.mjs`, `godot/ChangshanLongdan/data/reference.json`, `godot/ChangshanLongdan/tests/reference_cases.json`。

**Interfaces:** exporter imports authoritative TS MOVES/DIFFICULTIES/layout/castleSetup/Player/Enemies/Battle/Dragon; writes schemaVersion1 + used-source SHA256 + runtime data; `--check` compares bytes without writing. Golden contains fixed controls/steps, expected state/events, not callable Godot functions.

- [x] Write Node tests first: generated reference missing/stale rejects, export17 move IDs/4 profiles/300 spawns and320 capacity, trace cases include N1→N6、N3→C4、hash反例query=[1,0]/nearest=1、1,1,2,1命中數[1,0,1,1]、實際Player/Dragon/Player交錯，以及constructor/start/retry RNG生命周期；derived data cannot mutate source; observe RED.
- [x] Implement minimal exporter using existing Node TS stripping, stable JSON and readonly source hashes; generate fixtures **before** GDScript implementation. No new package.
- [x] Run `node --test scripts/tests/godot-reference.node.mjs` and `node --experimental-strip-types scripts/godot-reference.mjs --check`; require PASS and no source changes. Save checkpoint.

## Task 2: Math, arena and spatial grid

**Files:** create `core/sim_math.gd`, `core/arena.gd`, `core/spatial_hash.gd`, `tests/gameplay.gd` under Godot project。

**Interfaces:** SimMath static damp/dampAngle/sampleKeys/smoothstep/next_stamp; RNG instance seed7 with unsigned32 mulberry32; Arena.new(limit,obstacles).constrain(pos:Vector3,radius)->Vector3; SpatialHash.new(cellSize).clear/insert/query按cell X、cell Z遞增，再按cell內插入順序回傳，不全域排序。

- [x] Add Godot cases first: seed7 first outputs equal golden, negative-angle wrap, sample heights, edge/corner/interior rectangle push, radius-aware arc/circle/line and reach, hash order at negative/cell boundaries；id0=(1,0)、id1=(-1,0)、query(0,0,3)必須[1,0]，不能偷偷sort。 Observe RED with missing core.
- [x] Port source math and unsigned low32 operations; preserve constrain tie priority. Packed arrays later keep Float32 rounding; no engine rigidbody substitution.
- [x] Execute focused SceneTree tests and source golden assertions; GREEN before dependent models. Save checkpoint.

## Task 3: Player and complete move routing

**Files:** create `core/player.gd`; extend gameplay tests。

**Interfaces:** Player.new(moves), reset/queue/clearQueuedActions/update/takeHit/gainMusou per SPEC; readable state/events/activeHits; aim callable returns target Dictionary or null; Arena from Task2。

- [x] Add failing source-trace and direct assertions for all combo routes, long-buffer N5→N6, C priority, JA/JC landing, dodge invulnerability/DASH, parry12 gauge/COUNTER, chip/backhit, lethal block, armor, hit-window crossing, 同window重用同一stamp identity（敵方僅比較last stamp）and musou100 consume/complete invulnerability.
- [x] Port source state machine without animation-controlled damage or new cancel rules; maintain source field names and scalar precision. Run actual Godot tests until GREEN.
- [x] Compare snapshots and event sequences against old-TS golden, not copied Godot output. Save checkpoint.

## Task 4: 300-enemy simulation

**Files:** create `core/enemies.gd`; extend gameplay tests。

**Interfaces:** Enemies.new(capacity,seed,profile), setPressure/reset/update/nearest/applyHit and SoA/strikes/kills; consumes shared rng/hash/arena; windows consume source canonical shapes。

- [x] Write RED assertions for 300/capacity, Float32 seeded reset properties, captain HP/damage, engagement54 and minimum20 logic, token budget per profile, windup→strike/recover, crowd collision, directional/radial/height hit filtering, 連續last-stamp抑制、1,1,2,1→[1,0,1,1]與Player/Dragon/Player各自命中[1,1,1]，flinch/air/knockdown/getup/death/kill consumption.
- [x] Port update/hash/separate ordering；nearest等距取第一個hash query候選（上述反例為id1），engagement距離sort才以原id次序穩定tie； reuse PackedFloat32Array/byte/int arrays, not300 per-enemy physics bodies. GREEN against fixtures.
- [x] Verify reset RNG lifetime: Battle constructor已reset normal，首次Game.start再reset所選難度，retry再reset同難度，三者共享同一EnemyStore RNG連續狀態，不能把首次start當成fresh constructor或retry時重seed； save checkpoint.

## Task 5: Battle, dragon and outcomes

**Files:** create `core/dragon.gd`, `core/battle.gd`; extend gameplay tests。

**Interfaces:** Dragon consumes canonical hit/duration and shared stamps; Battle.new(reference, optional setup), reset/interrupt/step/result and public readonly-view use fields; player/SoA from Tasks3/4; events/hits/kills reset everystep。

- [x] Write RED for phase60/150/240, hitstop queue, combo2.4, musou gain and dragon rhythm.35..2.55/.12, height trajectory/stop3.6, kills once, damage/chip/parry, source victory-before-defeat priority, result frozen time and original S/A/B/C/D boundaries (7 source-derived boundary cases minimum).
- [x] Port exact source call order and result slowmo; do not expose debug/heal/clear in runtime input. GREEN against seeded small-scenario and actual300-start traces.
- [x] Save gameplay-model checkpoint; still not natural300KO/S proof.

## Task 6: Native input, camera and procedural presentation

**Files:** create `scripts/game_input.gd`, `scripts/camera_rig.gd`, `scripts/game_view.gd`。

**Interfaces:** GameInput.sample(dt) returns source InputFrame keys and clear(); CameraRig snap/recenter/update/to_controls; GameView.update(battle,simDt) only reads models, owns player tip/tipBase and enemy MultiMeshes; world geometry reads canonical obstacles/layout。

- [x] RED tests: real InputMap key/mouse/pad bindings, normalization/deadzone, .18 held attack/.48 charge priority, clear-after-pause/focus, camera world basis/zoom/recenter and finite look-at,300 instance capacity and shared obstacle positions, explicit fallback status and tip/tipBase presence.
- [x] Compose Godot built-in input/Camera3D/Control/MultiMesh with minimal adapters; no View-owned HP/damage. Visible humanoid/spear/flash/dragon path are fallback, not original asset readiness.
- [x] GREEN structural/rule checks. Do not perform blocked native focus or browser QA; preserve visual/handfeel gaps.

## Task 7: Playable main, UI and validation integration

**Files:** create `scripts/game.gd`, `scenes/game.tscn`; modify `project.godot`, `export_presets.cfg`, `tests/smoke.gd`, `scripts/lib/godot-execution.mjs`, `scripts/tests/godot-execution.node.mjs`。

**Interfaces:** Game owns title/playing/paused/ended and start_battle/set_paused/tick; all GUI/key entrypaths call these; aggregate gameplay cases into existing fresh JSON report schema. Runner inventory reports mainScene and accepts explicit bootstrap diagnostic or game path only.

- [x] RED tests: game PackedScene is real configured main;300 battle binds view/HUD; difficulty start and retry preserve selected profile; controls and button use same start; pause/focus clear queued keys; result delay2.4, Enter retry and no ghost action; unrelated mainScene rejected by inventory；新game選單的應用Quit僅原生顯示，Web隱藏（headless驗配置，不開瀏覽器）。
- [x] Wire native F5 entry, title/HUD/pause/results and frozen-result stats; add `data/*.json` to both export include filters while excluding tests; retain bootstrap for diagnostics only. Preserve all process/hash/report checks and old meaningful diagnostic cases.
- [x] GREEN Node tests + canonical check + actual Godot import and combined nonzero tests through existing runner. Save checkpoint.

## Task 8: Reviewable native delivery

**Files:** update `README.md`, `docs/godot/README.md`; create/update `docs/godot/G02_PROGRESS.md`。

- [x] Reconcile scope vs source. Root README makes Godot import/F5 the primary developer path; legacy Web remains reference and its unrelated instructions are preserved, deleted governance not restored.
- [x] Record tested / visual-not-run / final-asset-not-ready / no-Jev separately. Actual command results and raw logs outside repo; don't repeat unaffected308 tests merely for a new label.
- [ ] Freeze candidate, give complete diff and source/tests/raw evidence to fresh independent Astra reviewer. Fix only concrete authorized findings within existing limits and rerun affected checks.
- [ ] Continue next authorized needed step unless concrete runtime/tool/authorization blocker; no push/PR/merge or new UI attempt budget inferred. Do not claim whole migration complete.
