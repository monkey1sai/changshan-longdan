extends RefCounted

var cases: Array[Dictionary] = []
func check(name: String, passed: bool) -> void:
	cases.append({"name": "gameplay_" + name, "pass": passed})

func run() -> Array[Dictionary]:
	cases.clear()
	check("oracle_hp_array_tolerance_strict",difference({"fields":{"hp":[229.0005]}},{"fields":{"hp":[229.0]}})!="")
	check("oracle_discrete_counts_exact",difference({"ko":300.0005},{"ko":300.0})!="")
	check("oracle_rejects_nan",difference({"pos":[NAN]},{"pos":[0.0]})!="")
	check("oracle_accepts_valid_position_rounding",difference({"pos":[1.0005]},{"pos":[1.0]})=="")
	var required = ["sim_math", "arena", "spatial_hash"]
	for name in required:
		check(name + "_available", FileAccess.file_exists("res://core/" + name + ".gd"))
	if cases.any(func(c): return not c["pass"]):
		return cases
	var M = load("res://core/sim_math.gd")
	var A = load("res://core/arena.gd")
	var H = load("res://core/spatial_hash.gd")
	var reference = JSON.parse_string(FileAccess.get_file_as_string("res://tests/reference_cases.json"))
	var random = M.rng(7)
	for i in range(reference.math.rng.size()):
		check("rng_seed7_" + str(i), absf(random.call() - reference.math.rng[i]) < 1e-12)
	check("angle_wrap", absf(M.wrapAngle(PI * 3.0) + PI) < 1e-12)
	check("damp", absf(M.damp(0.0, 10.0, 12.0, 1.0 / 60.0) - 1.8126924692201818) < 1e-12)
	check("sample_keys", absf(M.sampleKeys([[0.0, 0.0], [1.0, 2.0]], 0.5) - 1.0) < 1e-12)
	var first_stamp = M.next_stamp()
	check("stamps_positive_distinct", first_stamp > 0 and M.next_stamp() != first_stamp)
	for i in range(reference.math.geometry.size()):
		var c = reference.math.geometry[i]
		check("shape_" + str(i), M.inHitShape(c.shape, 0.0, 0.0, 0.0, c.x, c.z, c.radius) == c.expected)
		check("shape_reach_" + str(i), absf(M.shapeReach(c.shape) - c.reach) < 1e-10)
	for i in range(reference.math.arena.size()):
		var c = reference.math.arena[i]
		var arena = A.new(c.limit, c.obstacles)
		var p = arena.constrain(Vector3(c.pos.x, 0, c.pos.z), c.radius)
		check("arena_" + str(i), absf(p.x - c.expected.x) < 1e-5 and absf(p.z - c.expected.z) < 1e-5)
	var hash_grid = H.new(2.0)
	hash_grid.insert(0, 1.0, 0.0)
	hash_grid.insert(1, -1.0, 0.0)
	check("hash_cell_order_not_id_order", hash_grid.query(0.0, 0.0, 3.0) == [1, 0])
	hash_grid.clear()
	check("hash_clear", hash_grid.query(0.0, 0.0, 3.0).is_empty())
	hash_grid.insert(9, -0.01, -0.01)
	hash_grid.insert(3, -0.02, -0.02)
	check("hash_insertion_order", hash_grid.query(-0.01, -0.01, 0.01) == [9, 3])
	check("player_available", FileAccess.file_exists("res://core/player.gd"))
	if not FileAccess.file_exists("res://core/player.gd"):
		return cases
	var P = load("res://core/player.gd")
	var runtime = JSON.parse_string(FileAccess.get_file_as_string("res://data/reference.json"))
	for trace in reference.player:
		var player = P.new(runtime.moves)
		player.reset(0.0, 0.0, 0.0)
		for key in trace.initial:
			player.set(key, trace.initial[key])
		if trace.preQueue != null:
			player.queue(trace.preQueue)
		if trace.preClear:
			player.clearQueuedActions()
		var inputs: Dictionary = {}
		var samples: Dictionary = {}
		for entry in trace.inputs:
			inputs[int(entry.frame)] = entry.input
		for entry in trace.samples:
			samples[int(entry.frame)] = entry.expected
		for frame in range(int(trace.frames)):
			player.update(float(reference.stepNumerator) / float(reference.stepDenominator), inputs.get(frame, {}), func(_x, _z, _r): return null, A.new(200.0, []))
			for hit in trace.hits:
				if int(hit.frame) == frame:
					player.takeHit(hit.damage, hit.heavy, hit.x, hit.z)
			if samples.has(frame):
				var actual = player_snapshot(player, runtime.moves)
				var mismatch = difference(actual, samples[frame])
				check(trace.id + "_frame_" + str(frame), mismatch == "")
				if mismatch != "":
					print("G02_MISMATCH ", trace.id, " frame=", frame, " ", mismatch)
	check("enemies_available", FileAccess.file_exists("res://core/enemies.gd"))
	if not FileAccess.file_exists("res://core/enemies.gd"):
		return cases
	var E = load("res://core/enemies.gd")
	for trace in reference.enemy:
		var enemies = E.new(8, 7, runtime.difficulties[trace.profile])
		enemies.reset(trace.spawns)
		check("enemy_" + trace.profile + "_seeded_reset", difference(enemy_snapshot(enemies), trace.initial) == "")
		var samples: Dictionary = {}
		for item in trace.samples: samples[int(item.frame)] = item
		for frame in range(int(trace.frames)):
			enemies.update(float(reference.stepNumerator) / float(reference.stepDenominator), 0.0, 0.0, 0.0, A.new(20.0, []))
			if samples.has(frame):
				var mismatch = difference(enemy_snapshot(enemies), samples[frame].expected)
				if mismatch == "": mismatch = difference(enemies.strikes, samples[frame].strikes)
				check("enemy_" + trace.profile + "_frame_" + str(frame), mismatch == "")
				if mismatch != "": print("G02_ENEMY_MISMATCH ", trace.profile, " frame=", frame, " ", mismatch)
	var ties = E.new(2, 7, runtime.difficulties.normal)
	ties.reset([{"x":1.0,"z":0.0,"yaw":0.0,"kind":0},{"x":-1.0,"z":0.0,"yaw":0.0,"kind":0}])
	check("nearest_first_hash_candidate_not_lowest_id", ties.nearest(0.0, 0.0, 3.0) == 1)
	var stamp_target = E.new(1, 7, runtime.difficulties.normal)
	stamp_target.reset([{"x":0.0,"z":1.0,"yaw":0.0,"kind":2}])
	var counts: Array = []
	var hit_hp: Array = []
	for stamp in reference.contracts.stampSequence.input:
		var hits: Array = []
		stamp_target.applyHit(int(stamp), reference.contracts.stampSequence.window, 0.0, 0.0, 0.0, 0.0, hits)
		counts.append(hits.size())
		hit_hp.append(stamp_target.hp[0])
	check("single_last_stamp_interleaving", difference(counts, reference.contracts.stampSequence.hitCounts) == "" and difference(hit_hp, reference.contracts.stampSequence.hp) == "")
	var castle_soldiers = E.new(320, 7, runtime.difficulties.normal)
	castle_soldiers.reset(runtime.spawns)
	check("three_hundred_enemy_storage", castle_soldiers.count == 300 and castle_soldiers.aliveCount == 300 and castle_soldiers.x.size() == 320)
	check("dragon_available", FileAccess.file_exists("res://core/dragon.gd"))
	check("battle_available", FileAccess.file_exists("res://core/battle.gd"))
	if not FileAccess.file_exists("res://core/dragon.gd") or not FileAccess.file_exists("res://core/battle.gd"):
		return cases
	var D = load("res://core/dragon.gd")
	var B = load("res://core/battle.gd")
	var dragon = D.new(runtime.dragon)
	dragon.start(Vector3.ZERO, 0.0)
	for i in range(reference.dragon.size()):
		dragon.update(1.0 / 10.0, Vector3(1, 0, 2), 0.3)
		var actual = {"active":dragon.active,"striking":dragon.striking,"elapsed":dragon.elapsed,"headPos":[dragon.headPos.x,dragon.headPos.y,dragon.headPos.z]}
		var expected = reference.dragon[i].duplicate()
		expected.erase("dt")
		check("dragon_trajectory_" + str(i), difference(actual, expected) == "")
	for trace in reference.battle:
		var battle = B.new(runtime, trace.setup)
		battle.reset(trace.profile)
		var inputs: Dictionary = {}
		var samples: Dictionary = {}
		for item in trace.inputs: inputs[int(item.frame)] = item.input
		for item in trace.samples: samples[int(item.frame)] = item.expected
		for frame in range(int(trace.frames)):
			var advanced = battle.step(float(reference.stepNumerator) / float(reference.stepDenominator), inputs.get(frame, {}))
			if samples.has(frame):
				var actual = {"advanced":advanced,"outcome":battle.outcome,"ko":battle.ko,"combo":battle.combo,"maxCombo":battle.maxCombo,"damageTaken":battle.damageTaken,"battleTime":battle.battleTime,"hitstop":battle.hitstop,"phase":battle.phase,"player":player_snapshot(battle.player,runtime.moves),"enemy":enemy_snapshot(battle.enemies),"events":battle.events,"hits":battle.hits,"kills":battle.kills,"result":battle.result()}
				var mismatch = difference(actual, samples[frame])
				check("battle_" + trace.profile + "_frame_" + str(frame), mismatch == "")
				if mismatch != "": print("G02_BATTLE_MISMATCH ", trace.profile, " frame=", frame, " ", mismatch)
	for i in range(reference.rank.size()):
		check("original_rank_boundary_" + str(i), B.rank_result(reference.rank[i].input) == reference.rank[i].expected)
	var battle = B.new(runtime)
	for i in range(reference.contracts.lifecycle.size()):
		if i > 0: battle.reset("hard")
		var actual = {"hp":[],"phase":[]}
		for id in [0,1,9,17]:
			actual.hp.append(battle.enemies.hp[id])
			actual.phase.append(battle.enemies.phase[id])
		check("battle_rng_lifecycle_" + str(i), difference(actual, {"hp":reference.contracts.lifecycle[i].hp,"phase":reference.contracts.lifecycle[i].phase}) == "")
	var inter_player = P.new(runtime.moves)
	inter_player.reset(0,0,0)
	inter_player.musou = 100
	var inter_dragon = D.new(runtime.dragon)
	var arena = A.new(55.0, [])
	for frame in range(28):
		inter_player.update(1.0/60.0, {"musou":frame==0}, func(_x,_z,_r): return null, arena)
		for event in inter_player.events:
			if event.type == "musouStart": inter_dragon.start(inter_player.pos,inter_player.facing)
		inter_dragon.update(1.0/60.0,inter_player.pos,inter_player.facing)
	var target = E.new(1,7,runtime.difficulties.normal)
	target.reset([reference.contracts.playerDragon.targetSpawn])
	var inter_counts: Array = []
	var inter_hp: Array = []
	var h = inter_player.activeHits[0]
	var out: Array = []
	target.applyHit(h.stamp,h.window,h.x,h.y,h.z,h.facing,out)
	inter_counts.append(out.size()); inter_hp.append(target.hp[0]); out.clear()
	target.applyHit(inter_dragon.stamp,runtime.dragon.hit,inter_dragon.headPos.x,inter_dragon.headPos.y,inter_dragon.headPos.z,0,out)
	inter_counts.append(out.size()); inter_hp.append(target.hp[0]); out.clear()
	inter_player.update(1.0/60.0,{},func(_x,_z,_r): return null,arena)
	target.update(1.0/60.0,inter_player.pos.x,inter_player.pos.y,inter_player.pos.z,arena)
	inter_dragon.update(1.0/60.0,inter_player.pos,inter_player.facing)
	h = inter_player.activeHits[0]
	target.applyHit(h.stamp,h.window,h.x,h.y,h.z,h.facing,out)
	inter_counts.append(out.size()); inter_hp.append(target.hp[0])
	check("actual_player_dragon_player_last_stamp", difference(inter_counts,reference.contracts.playerDragon.hitCounts)=="" and difference(inter_hp,reference.contracts.playerDragon.hp)=="")
	for boundary in [[59,"opening"],[60,"pressure"],[149,"pressure"],[150,"surge"],[239,"surge"],[240,"finale"]]:
		battle.ko = boundary[0]
		battle.updatePressure()
		check("pressure_boundary_" + str(boundary[0]), battle.phase == boundary[1])
	var tiny = {"limit":20.0,"obstacles":[],"spawns":[{"x":10.0,"z":10.0,"yaw":0.0,"kind":0}],"playerStart":{"x":0.0,"z":0.0,"facing":0.0},"capacity":8,"enemySeed":7}
	var stopped = B.new(runtime,tiny)
	stopped.hitstop = 0.02
	check("hitstop_queues_not_advances", stopped.step(1.0/60.0,{"attack":true}) == 0 and stopped.player.move == null)
	stopped.step(1.0/60.0,{})
	stopped.step(1.0/60.0,{})
	check("hitstop_buffer_consumed_after_pause", stopped.player.move != null and stopped.player.move.id == "N1")
	stopped.combo = 3
	stopped.comboTimer = 0.001
	stopped.step(1.0/60.0,{})
	check("combo_expires", stopped.combo == 0)
	var fatal = B.new(runtime,tiny)
	fatal.player.hp = 40
	fatal.player.update(0.2,{"guard":true},func(_x,_z,_r): return null,fatal.arena)
	fatal.player.update(0.2,{"guard":true},func(_x,_z,_r): return null,fatal.arena)
	fatal.resolveStrike({"damage":100.0,"heavy":true,"x":0.0,"z":2.0})
	fatal.checkOutcome()
	check("lethal_chip_defeat", fatal.outcome == "defeat" and fatal.damageTaken == 40 and fatal.player.state == "dead")
	var winner = B.new(runtime,tiny)
	var lethal_window = runtime.dragon.hit.duplicate(true)
	lethal_window.damage = 1000.0
	lethal_window.shape = {"kind":"circle","range":400.0}
	winner.enemies.applyHit(M.next_stamp(),lethal_window,0,0,0,0,[])
	winner.step(1.0/60.0,{})
	var frozen_time = winner.battleTime
	winner.step(1.0/60.0,{"attack":true})
	check("fixture_victory_consumes_kill_once_freezes_clock", winner.outcome == "victory" and winner.ko == 1 and winner.battleTime == frozen_time)
	var simultaneous = B.new(runtime,tiny)
	simultaneous.enemies.applyHit(M.next_stamp(),lethal_window,0,0,0,0,[])
	simultaneous.player.state = "dead"
	simultaneous.player.hp = 0
	simultaneous.step(1.0/60.0,{})
	check("source_victory_before_defeat_priority", simultaneous.outcome == "victory")
	var adapters = ["game_input", "camera_rig", "game_view"]
	var adapters_ready: bool = true
	for name in adapters:
		var present: bool = FileAccess.file_exists("res://scripts/" + name + ".gd")
		check(name + "_available", present)
		adapters_ready = adapters_ready and present
	if not adapters_ready:
		return cases
	var I = load("res://scripts/game_input.gd")
	var C = load("res://scripts/camera_rig.gd")
	var V = load("res://scripts/game_view.gd")
	var input = I.new()
	input.clear()
	check("input_actions_installed", InputMap.has_action("cld_attack") and InputMap.has_action("cld_guard") and InputMap.has_action("cld_recenter"))
	check("input_native_pad_semantics", I.PAD_BUTTONS.attack == JOY_BUTTON_X and I.PAD_BUTTONS.guard == JOY_BUTTON_LEFT_SHOULDER and I.PAD_BUTTONS.recenter == JOY_BUTTON_RIGHT_STICK)
	check("input_deadzone", I.deadzone(0.1) == 0.0 and absf(I.deadzone(0.6) - 0.5) < 1e-12)
	Input.action_press("cld_move_right")
	Input.action_press("cld_move_forward")
	var frame = input.sample(1.0/60.0)
	check("input_diagonal_normalized", absf(frame.moveX - sqrt(0.5)) < 1e-6 and absf(frame.moveY - sqrt(0.5)) < 1e-6)
	input.clear()
	Input.action_press("cld_attack")
	var pulses: int = 0
	for _frame in range(12):
		if input.sample(1.0/60.0).attack: pulses += 1
	check("input_hold_attack_pulses", pulses == 2)
	Input.action_press("cld_charge")
	frame = input.sample(1.0/60.0)
	check("input_charge_priority", frame.charge and not frame.attack)
	input.clear()
	frame = input.sample(1.0/60.0)
	check("input_focus_clear_has_no_ghost_actions", not frame.attack and not frame.charge and frame.moveX == 0 and frame.moveY == 0)
	var rig = C.new()
	Engine.get_main_loop().root.add_child(rig.camera)
	rig.snap(Vector3.ZERO, PI)
	var controls = rig.to_controls({"moveX":0.0,"moveY":1.0,"attack":true})
	check("camera_relative_forward", absf(controls.moveX) < 1e-6 and absf(controls.moveZ + 1.0) < 1e-6 and controls.attack)
	rig.update(1.0/60.0,Vector3.ZERO,0.0,-100.0,false,false,0.0)
	check("camera_zoom_clamped", rig.distance == 5.5 and rig.camera.position.is_finite())
	rig.recenter(0.0)
	rig.update(1.0/60.0,Vector3.ZERO,0.0,0.0,false,false,0.0)
	check("camera_recenter_moves", rig.yaw != PI)
	var view = V.new(runtime)
	Engine.get_main_loop().root.add_child(view)
	view.update(battle, 1.0/60.0)
	check("fallback_clearly_identified", view.assetStatus == "procedural_fallback")
	check("weapon_tip_contract", view.has_node("Player/Weapon/tip") and view.has_node("Player/Weapon/tipBase"))
	check("enemy_instancing_capacity", view.enemyMeshes.body.multimesh.instance_count == 320)
	check("world_uses_same_obstacle_layout", view.obstacleMeshes.size() == runtime.layout.obstacles.size() and absf(view.obstacleMeshes[0].mesh.size.x - 40.0) < 1e-6)
	view.free()
	rig.camera.free()
	check("playable_main_scene_available", FileAccess.file_exists("res://scenes/game.tscn"))
	if not FileAccess.file_exists("res://scenes/game.tscn"):
		return cases
	var game = load("res://scenes/game.tscn").instantiate()
	Engine.get_main_loop().root.add_child(game)
	game.set_physics_process(false)
	check("f5_enters_game_not_bootstrap", ProjectSettings.get_setting("application/run/main_scene") == "res://scenes/game.tscn" and game.mode == "title")
	game.difficultySelect.select(2)
	game.startButton.pressed.emit()
	check("native_start_binds_three_hundred_and_difficulty", game.mode == "playing" and game.battle.enemies.aliveCount == 300 and game.battle.difficulty == "hard" and game.hudLabel.text.contains("300"))
	game.battle.player.queue({"attack":true})
	Input.action_press("cld_charge")
	game.set_paused(true)
	var time_before: float = game.battle.battleTime
	game.tick(1.0/60.0,{"attack":true})
	check("pause_freezes_battle", game.mode == "paused" and game.battle.battleTime == time_before)
	game.resumeButton.pressed.emit()
	game.tick(1.0/60.0,game.controls.sample(1.0/60.0))
	check("resume_clears_pending_actions", game.mode == "playing" and game.battle.player.move == null)
	game._notification(Node.NOTIFICATION_APPLICATION_FOCUS_OUT)
	check("native_focus_loss_pauses", game.mode == "paused")
	game.set_paused(false)
	game.battle.outcome = "victory"
	game.mode = "ended"
	game.endTimer = 0.03
	game.resultShown = false
	game.tick(0.01,{})
	check("result_delay_not_skipped", not game.resultShown)
	game.tick(0.03,{})
	check("result_gui_present", game.resultShown and game.resultPanel.visible)
	game.difficultySelect.select(0)
	game.retryButton.pressed.emit()
	check("retry_preserves_difficulty_and_resets", game.mode == "playing" and game.battle.difficulty == "hard" and game.battle.ko == 0 and game.battle.player.hp == 1000)
	game.configure_platform_actions("Web")
	check("game_web_no_application_quit", not game.quitButton.visible)
	game.configure_platform_actions("Windows")
	check("game_native_application_quit_available", game.quitButton.visible)
	game.mode = "title"
	game.difficultySelect.select(1)
	game.tick(1.0/60.0,{"confirm":true})
	check("keyboard_confirm_uses_same_start", game.mode == "playing" and game.battle.difficulty == "normal")
	game.free()
	var keyed = load("res://scenes/game.tscn").instantiate()
	Engine.get_main_loop().root.add_child(keyed)
	keyed.set_physics_process(false)
	var key_event = InputEventKey.new()
	key_event.physical_keycode = KEY_J
	key_event.pressed = true
	Input.parse_input_event(key_event)
	Input.flush_buffered_events()
	keyed.tick(1.0/60.0,keyed.controls.sample(1.0/60.0))
	check("native_key_event_starts_and_attacks", keyed.mode == "playing" and keyed.battle.player.move != null and keyed.battle.player.move.id == "N1")
	key_event.pressed = false
	Input.parse_input_event(key_event)
	Input.flush_buffered_events()
	keyed.controls.clear()
	keyed.free()
	for trace in reference.enemyReactions:
		var soldiers = E.new(8,int(trace.seed),runtime.difficulties.normal)
		soldiers.reset(trace.spawns)
		if trace.window.reaction == "flinch":
			soldiers.state[0] = 3
			soldiers.stateTime[0] = 0.1
		check("enemy_reaction_before_" + trace.id,difference(enemy_snapshot(soldiers),trace.before)=="")
		var out_hits: Array = []
		soldiers.applyHit(123,trace.window,0,0,0,0,out_hits)
		check("enemy_reaction_initial_" + trace.id,difference(enemy_snapshot(soldiers),trace.initial)=="" and difference(out_hits,trace.hits)=="")
		var samples: Dictionary = {}
		for sample in trace.samples: samples[int(sample.frame)] = sample
		for step_index in range(int(trace.frames)):
			soldiers.update(1.0/60.0,0,0,0,A.new(30,[]))
			if samples.has(step_index):
				var mismatch = difference(enemy_snapshot(soldiers),samples[step_index].expected)
				check("enemy_reaction_" + trace.id + "_" + str(step_index),mismatch=="" and difference(soldiers.strikes,samples[step_index].strikes)=="")
				if mismatch!="": print("G02_REACTION_MISMATCH ",trace.id," frame=",step_index," ",mismatch)
	for trace in reference.army:
		var soldiers = E.new(320,7,runtime.difficulties[trace.profile])
		soldiers.reset(runtime.spawns)
		var samples: Dictionary = {}
		for sample in trace.samples: samples[int(sample.frame)] = sample.expected
		var army_arena = A.new(runtime.layout.limit,runtime.layout.obstacles)
		for step_index in range(int(trace.frames)):
			soldiers.update(1.0/60.0,trace.player.x,trace.player.y,trace.player.z,army_arena)
			if samples.has(step_index):
				var actual = enemy_snapshot(soldiers)
				for key in actual.fields:
					var selected: Array = []
					for id in trace.ids: selected.append(soldiers.get(key)[int(id)])
					actual.fields[key] = selected
				actual.engagedCount = 0
				actual.marchCount = 0
				for id in range(soldiers.count):
					if soldiers.engaged[id] == 1: actual.engagedCount += 1
					if soldiers.state[id] == 1: actual.marchCount += 1
				var mismatch = difference(actual,samples[step_index])
				check("army_" + trace.profile + "_" + str(trace.player.z) + "_" + str(step_index),mismatch=="")
				if mismatch!="": print("G02_ARMY_MISMATCH ",trace.profile," player=",trace.player.z," frame=",step_index," ",mismatch)
	return cases

func enemy_snapshot(e: Variant) -> Dictionary:
	var fields: Dictionary = {}
	for key in ["x","y","z","vx","vy","vz","yaw","hp","maxHp","stateTime","flash","phase","moveBlend","spin","spinVel","cooldown","ring","side","scale","state","kind","alive","engaged","token"]:
		fields[key] = Array(e.get(key)).slice(0, e.count)
	return {"count":e.count,"aliveCount":e.aliveCount,"attackerCount":e.attackerCount,"fields":fields}

func difference(actual: Variant, expected: Variant, at: String = "root") -> String:
	if expected is Dictionary:
		if not actual is Dictionary:
			return at + " not a Dictionary"
		for key in expected:
			if not actual.has(key):
				return at + " missing " + str(key)
			var found = difference(actual[key], expected[key], at + "." + str(key))
			if found != "":
				return found
	elif expected is Array:
		if not actual is Array or actual.size() != expected.size():
			return at + " array size"
		for i in range(expected.size()):
			var found = difference(actual[i], expected[i], at + "[" + str(i) + "]")
			if found != "":
				return found
	elif expected is float or expected is int:
		var property_name: String = at.get_slice(".",at.get_slice_count(".")-1).get_slice("[",0)
		var discrete: bool = property_name in ["ko","combo","maxCombo","count","aliveCount","attackerCount","engagedCount","marchCount","state","kind","alive","engaged","token","id","start","index","normalCount"]
		var tolerance: float = 0.0 if discrete else (0.0001 if property_name in ["hp","maxHp"] else 0.001)
		if not (actual is float or actual is int) or not is_finite(float(actual)) or not is_finite(float(expected)) or absf(float(actual) - float(expected)) > tolerance:
			return at + " actual=" + str(actual) + " expected=" + str(expected)
	elif actual != expected:
		return at + " actual=" + str(actual) + " expected=" + str(expected)
	return ""

func player_snapshot(p: Variant, moves: Dictionary) -> Dictionary:
	var hits: Array = []
	for hit in p.activeHits:
		for id in moves:
			var index: int = moves[id].hits.find(hit.window)
			if index >= 0:
				hits.append({"moveId": id, "index": index, "origin": [hit.x, hit.y, hit.z], "facing": hit.facing})
				break
	return {"pos": [p.pos.x, p.pos.y, p.pos.z], "vel": [p.vel.x, p.vel.y, p.vel.z], "facing": p.facing,
		"state": p.state, "stateTime": p.stateTime, "moveId": p.move.id if p.move != null else null,
		"moveTime": p.moveTime, "normalCount": p.normalCount, "hp": p.hp, "musou": p.musou, "invuln": p.invuln,
		"speed": p.speed, "runPhase": p.runPhase, "dodgeBack": p.dodgeBack, "guardTimer": p.guardTimer,
		"parryTimer": p.parryTimer, "counterReady": p.counterReady, "events": p.events, "activeHits": hits}
