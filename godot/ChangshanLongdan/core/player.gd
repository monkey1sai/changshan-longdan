extends RefCounted
const M = preload("res://core/sim_math.gd")
const RUN_SPEED = 7.4
const GRAVITY = 30.0
const JUMP_SPEED = 10.5
const BUFFER = 0.45
const IDLE = {"moveX":0.0,"moveZ":0.0,"attack":false,"charge":false,"jump":false,"dodge":false,"musou":false,"guard":false}
var moves: Dictionary
var pos: Vector3 = Vector3.ZERO
var vel: Vector3 = Vector3.ZERO
var facing: float = PI
var state: String = "move"
var stateTime: float = 0.0
var move: Variant = null
var moveTime: float = 0.0
var normalCount: int = 0
var hp: float = 1000.0
var maxHp: float = 1000.0
var musou: float = 0.0
var invuln: float = 0.0
var speed: float = 0.0
var runPhase: float = 0.0
var dodgeBack: bool = false
var guardTimer: float = 0.0
var parryTimer: float = 0.0
var counterReady: float = 0.0
var events: Array = []
var activeHits: Array = []
var buffered: Variant = null
var bufferAge: float = 0.0
var jumpBuffer: float = 0.0
var dodgeBuffer: float = 0.0
var musouBuffer: float = 0.0
var stamps: Array = []
var moveStartY: float = 0.0
var dodgeDir: Vector3 = Vector3.ZERO
var musouReady: bool:
	get: return musou >= 100.0

func _init(definitions: Dictionary) -> void:
	moves = definitions

func reset(x: float, z: float, direction: float) -> void:
	pos = Vector3(x, 0, z)
	vel = Vector3.ZERO
	facing = direction
	state = "move"
	stateTime = 0.0
	move = null
	moveTime = 0.0
	normalCount = 0
	hp = maxHp
	musou = 0.0
	invuln = 0.0
	speed = 0.0
	guardTimer = 0.0
	parryTimer = 0.0
	counterReady = 0.0
	buffered = null
	jumpBuffer = 0.0
	dodgeBuffer = 0.0
	musouBuffer = 0.0
	events.clear()
	activeHits.clear()

func queue(c: Dictionary) -> void:
	if c.get("attack", false) and buffered != "charge":
		bufferButton("attack")
	if c.get("charge", false): bufferButton("charge")
	if c.get("jump", false): jumpBuffer = BUFFER
	if c.get("dodge", false): dodgeBuffer = BUFFER
	if c.get("musou", false): musouBuffer = BUFFER

func clearQueuedActions() -> void:
	buffered = null
	bufferAge = 0.0
	jumpBuffer = 0.0
	dodgeBuffer = 0.0
	musouBuffer = 0.0

func update(dt: float, controls: Dictionary, aim: Callable, arena: Variant) -> void:
	var c: Dictionary = IDLE.duplicate()
	c.merge(controls, true)
	events.clear()
	activeHits.clear()
	bufferAge += dt
	if bufferAge > BUFFER: buffered = null
	jumpBuffer = maxf(0, jumpBuffer - dt)
	dodgeBuffer = maxf(0, dodgeBuffer - dt)
	musouBuffer = maxf(0, musouBuffer - dt)
	parryTimer = maxf(0, parryTimer - dt)
	counterReady = maxf(0, counterReady - dt)
	queue(c)
	invuln = maxf(0, invuln - dt)
	stateTime += dt
	if musouBuffer > 0 and musouReady and canMusou(): startMusou()
	elif c.guard and canGuard(): startGuard()
	elif dodgeBuffer > 0 and canDodge(): startDodge(c)
	match state:
		"move": updateMove(dt, c, aim)
		"jump": updateJump(dt, c, aim)
		"attack", "musou": updateAttack(dt, c, aim)
		"dodge": updateDodge(dt, c, aim)
		"guard": updateGuard(dt, c, aim)
		"hurt": updateStagger(dt, 0.4)
		"down": updateStagger(dt, 1.3)
		"dead": updateStagger(dt, INF)
	pos = arena.constrain(pos, 0.45)

func takeHit(damage: float, heavy: bool, fromX: float, fromZ: float) -> bool:
	if state == "dead" or state == "musou" or invuln > 0: return false
	if state == "guard" and isGuardingSource(fromX, fromZ):
		if parryTimer > 0:
			parryTimer = 0
			counterReady = 0.72
			gainMusou(12)
			events.append({"type":"parry"})
			return false
		var blocked: float = damage * (0.45 if heavy else 0.25)
		hp = maxf(0, hp - blocked)
		gainMusou(3 if heavy else 2)
		events.append({"type":"guardBlock","damage":blocked,"heavy":heavy})
		if hp <= 0:
			state = "dead"
			stateTime = 0
			counterReady = 0
			events.append({"type":"death"})
		return true
	counterReady = 0
	var armored: bool = state == "attack" and move != null and move.get("armor", false)
	hp = maxf(0, hp - (damage * 0.5 if armored else damage))
	gainMusou(4)
	if hp <= 0:
		state = "dead"
		stateTime = 0
		move = null
		counterReady = 0
		events.append({"type":"death"})
		return true
	if armored:
		events.append({"type":"hurt","heavy":false})
		return true
	var dx: float = pos.x - fromX
	var dz: float = pos.z - fromZ
	var distance: float = sqrt(dx * dx + dz * dz)
	if distance == 0: distance = 1.0
	facing = atan2(-dx, -dz)
	move = null
	normalCount = 0
	state = "down" if heavy else "hurt"
	stateTime = 0
	vel = Vector3(dx / distance * (6 if heavy else 3), 0, dz / distance * (6 if heavy else 3))
	if heavy: invuln = 1.6
	events.append({"type":"hurt","heavy":heavy})
	return true

func gainMusou(amount: float) -> void:
	if state != "musou": musou = minf(100, musou + amount)

func bufferButton(button: String) -> void:
	buffered = button
	bufferAge = 0.0

func canMusou() -> bool:
	return state in ["move","attack","guard","hurt"] and pos.y < 0.05

func canGuard() -> bool:
	if pos.y >= 0.05: return false
	if state in ["move","guard"]: return true
	return state == "attack" and move != null and not move.get("airborne", false) and moveTime >= move.cancel

func startGuard() -> void:
	if state == "guard": return
	state = "guard"
	stateTime = 0
	move = null
	moveTime = 0
	normalCount = 0
	vel = Vector3.ZERO
	guardTimer = 0
	parryTimer = 0.16

func isGuardingSource(x: float, z: float) -> bool:
	var dx: float = x - pos.x
	var dz: float = z - pos.z
	var distance: float = sqrt(dx * dx + dz * dz)
	if distance == 0: distance = 1.0
	return (sin(facing) * dx + cos(facing) * dz) / distance >= cos(PI * 0.36)

func canDodge() -> bool:
	if state == "move": return pos.y < 0.05
	return state == "attack" and move != null and not move.get("airborne", false) and moveTime >= move.cancel * 0.75 and pos.y < 0.05

func startMusou() -> void:
	musou = 0
	musouBuffer = 0
	startMove("MUSOU", IDLE, func(_x, _z, _r): return null)
	invuln = moves.MUSOU.duration + 0.4
	events.append({"type":"musouStart"})

func startDodge(c: Dictionary) -> void:
	var length: float = sqrt(c.moveX * c.moveX + c.moveZ * c.moveZ)
	dodgeBack = length <= 0.1
	if dodgeBack: dodgeDir = Vector3(-sin(facing), 0, -cos(facing))
	else:
		dodgeDir = Vector3(c.moveX / length, 0, c.moveZ / length)
		facing = atan2(dodgeDir.x, dodgeDir.z)
	state = "dodge"
	stateTime = 0
	move = null
	normalCount = 0
	dodgeBuffer = 0
	buffered = null
	counterReady = 0
	invuln = maxf(invuln, 0.34)
	events.append({"type":"dodge"})

func startJump(c: Dictionary) -> void:
	jumpBuffer = 0
	state = "jump"
	stateTime = 0
	move = null
	normalCount = 0
	vel = Vector3(c.moveX * RUN_SPEED * 0.9, JUMP_SPEED, c.moveZ * RUN_SPEED * 0.9)
	pos.y = maxf(pos.y, 0.01)
	events.append({"type":"jump"})

func startMove(id: String, c: Dictionary, aim: Callable) -> void:
	move = moves[id]
	moveTime = 0
	state = "musou" if id == "MUSOU" else "attack"
	stateTime = 0
	stamps.clear()
	for _window in move.hits: stamps.append(M.next_stamp())
	normalCount = int(id.substr(1)) if id.begins_with("N") else 0
	buffered = null
	moveStartY = pos.y
	vel = Vector3.ZERO
	var length: float = sqrt(c.moveX * c.moveX + c.moveZ * c.moveZ)
	if length > 0.2: facing = atan2(c.moveX, c.moveZ)
	else:
		var target = aim.call(pos.x, pos.z, 6.5)
		if target != null: facing = atan2(target.x - pos.x, target.z - pos.z)
	events.append({"type":"moveStart","moveId":id})

func toMove() -> void:
	state = "move"
	stateTime = 0
	move = null

static func nextMove(current: Variant, count: int, airborne: bool, can_chain: bool, button: String) -> Variant:
	if current == "MUSOU": return null
	if airborne:
		if current != null: return null
		return "JA" if button == "attack" else "JC"
	if current == null: return "N1" if button == "attack" else "C1"
	if not can_chain: return null
	if str(current).begins_with("N"):
		if button == "attack": return "N" + str(count + 1) if count < 6 else null
		return "C" + str(count + 1) if count <= 5 else null
	return "N1" if button == "attack" else "C1"

func updateMove(dt: float, c: Dictionary, aim: Callable) -> void:
	vel.x = M.damp(vel.x, c.moveX * RUN_SPEED, 12, dt)
	vel.z = M.damp(vel.z, c.moveZ * RUN_SPEED, 12, dt)
	pos.x += vel.x * dt
	pos.z += vel.z * dt
	speed = sqrt(vel.x * vel.x + vel.z * vel.z)
	if c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01: facing = M.dampAngle(facing, atan2(c.moveX, c.moveZ), 14, dt)
	runPhase += speed * dt * 1.25
	if counterReady > 0 and buffered == "attack":
		counterReady = 0
		startMove("COUNTER", c, aim)
		return
	if jumpBuffer > 0:
		startJump(c)
		return
	if buffered != null:
		var next = nextMove(null, 0, false, true, buffered)
		if next != null: startMove(next, c, aim)

func updateGuard(dt: float, c: Dictionary, aim: Callable) -> void:
	guardTimer += dt
	speed = 0
	if c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01: facing = M.dampAngle(facing, atan2(c.moveX, c.moveZ), 10, dt)
	if counterReady > 0 and buffered == "attack":
		counterReady = 0
		startMove("COUNTER", c, aim)
		return
	if not c.guard:
		toMove()
		return
	if dodgeBuffer > 0: startDodge(c)

func updateJump(dt: float, c: Dictionary, aim: Callable) -> void:
	vel.x = M.damp(vel.x, c.moveX * RUN_SPEED * 0.85, 4, dt)
	vel.z = M.damp(vel.z, c.moveZ * RUN_SPEED * 0.85, 4, dt)
	vel.y -= GRAVITY * dt
	pos += vel * dt
	speed = sqrt(vel.x * vel.x + vel.z * vel.z)
	if c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01: facing = M.dampAngle(facing, atan2(c.moveX, c.moveZ), 6, dt)
	if buffered != null and pos.y > 0.4:
		var next = nextMove(null, 0, true, true, buffered)
		if next != null:
			startMove(next, c, aim)
			return
	if pos.y <= 0:
		pos.y = 0
		vel = Vector3.ZERO
		events.append({"type":"land","heavy":false})
		toMove()

func updateAttack(dt: float, c: Dictionary, aim: Callable) -> void:
	if move == null:
		toMove()
		return
	var m: Dictionary = move
	var previous: float = moveTime
	moveTime += dt
	var t: float = moveTime
	var has_input: bool = c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01
	if state == "musou":
		pos.x += c.moveX * 3.2 * dt
		pos.z += c.moveZ * 3.2 * dt
		if has_input: facing = M.dampAngle(facing, atan2(c.moveX, c.moveZ), 4, dt)
	elif t < 0.1 and has_input: facing = M.dampAngle(facing, atan2(c.moveX, c.moveZ), 18, dt)
	var fx: float = sin(facing)
	var fz: float = cos(facing)
	for l in m.lunge:
		var step: float = (M.smoothstep(l.t0, l.t1, t) - M.smoothstep(l.t0, l.t1, previous)) * l.distance
		if step > 0:
			pos.x += fx * step
			pos.z += fz * step
	if m.has("height"):
		var k: float = M.sampleKeys(m.height.keys, t)
		var was_air: bool = pos.y > 0.05
		pos.y = maxf(0, moveStartY * k if m.height.get("relative", false) else k)
		if was_air and pos.y <= 0.05: events.append({"type":"land","heavy":true})
	var heavy: bool = m.id.begins_with("C") or m.id == "N6" or m.id == "MUSOU"
	for swing in m.swings:
		if previous < swing and t >= swing: events.append({"type":"swing","heavy":heavy})
	for i in range(m.hits.size()):
		var w: Dictionary = m.hits[i]
		if t < w.t0 or previous > w.t1: continue
		if w.has("fx") and previous < w.t0: events.append({"type":"fx","fx":w.fx,"x":pos.x,"z":pos.z,"radius":w.shape.range})
		activeHits.append({"window":w,"stamp":stamps[i],"x":pos.x,"y":pos.y,"z":pos.z,"facing":facing})
	if state == "attack" and t >= m.cancel:
		if buffered != null:
			var next = nextMove(m.id, normalCount, pos.y > 0.3, true, buffered)
			if next != null:
				startMove(next, c, aim)
				return
		if jumpBuffer > 0 and not m.get("airborne", false) and pos.y <= 0.01:
			startJump(c)
			return
		var last_hit: float = m.hits[-1].t1 if not m.hits.is_empty() else 0.0
		if buffered == null and not m.get("airborne", false) and pos.y <= 0.01 and has_input and t >= last_hit:
			toMove()
			return
	if t >= m.duration:
		move = null
		normalCount = 0
		if pos.y > 0.02:
			state = "jump"
			stateTime = 0
			vel = Vector3.ZERO
		else: toMove()

func updateDodge(dt: float, c: Dictionary, aim: Callable) -> void:
	var v: float = 15.0 * (1.0 - M.smoothstep(0.08, 0.42, stateTime))
	pos.x += dodgeDir.x * v * dt
	pos.z += dodgeDir.z * v * dt
	speed = v
	if stateTime >= 0.1 and buffered == "attack":
		startMove("DASH", c, aim)
		return
	if stateTime >= 0.42: toMove()

func updateStagger(dt: float, duration: float) -> void:
	vel.x = M.damp(vel.x, 0, 5, dt)
	vel.z = M.damp(vel.z, 0, 5, dt)
	pos.x += vel.x * dt
	pos.z += vel.z * dt
	if pos.y > 0:
		vel.y -= GRAVITY * dt
		pos.y = maxf(0, pos.y + vel.y * dt)
	speed = 0
	if stateTime >= duration:
		if state == "down": invuln = maxf(invuln, 0.8)
		toMove()
