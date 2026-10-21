extends RefCounted

var cases: Array[Dictionary] = []
func check(name: String, passed: bool) -> void:
	cases.append({"name": "gameplay_" + name, "pass": passed})

func run() -> Array[Dictionary]:
	cases.clear()
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
	return cases

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
		var tolerance: float = 0.0001 if at.ends_with(".hp") else 0.001
		if not (actual is float or actual is int) or absf(float(actual) - float(expected)) > tolerance:
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
