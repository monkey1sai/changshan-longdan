extends RefCounted
const M = preload("res://core/sim_math.gd")
const H = preload("res://core/spatial_hash.gd")
const State = {"Formation":0,"March":1,"Engage":2,"Windup":3,"Strike":4,"Recover":5,"Flinch":6,"Air":7,"Knockback":8,"Down":9,"Getup":10,"Dead":11}
const BODY_RADIUS = 0.42
var capacity: int
var count: int = 0
var aliveCount: int = 0
var x = PackedFloat32Array()
var y = PackedFloat32Array()
var z = PackedFloat32Array()
var vx = PackedFloat32Array()
var vy = PackedFloat32Array()
var vz = PackedFloat32Array()
var yaw = PackedFloat32Array()
var hp = PackedFloat32Array()
var maxHp = PackedFloat32Array()
var stateTime = PackedFloat32Array()
var flash = PackedFloat32Array()
var phase = PackedFloat32Array()
var moveBlend = PackedFloat32Array()
var spin = PackedFloat32Array()
var spinVel = PackedFloat32Array()
var cooldown = PackedFloat32Array()
var ring = PackedFloat32Array()
var side = PackedFloat32Array()
var scale = PackedFloat32Array()
var state = PackedByteArray()
var kind = PackedByteArray()
var alive = PackedByteArray()
var engaged = PackedByteArray()
var token = PackedByteArray()
var hitStamp = PackedInt64Array()
var dist2 = PackedFloat32Array()
var kills: Array = []
var strikes: Array = []
var hash_grid = H.new(2.0)
var engageTimer: float = 0.0
var tokenTimer: float = 0.0
var attackers: int = 0
var difficulty: Dictionary
var engageRange: float
var maxAttackers: int
var random: Callable
var attackerCount: int:
	get: return attackers

func _init(size: int, seed: int, profile: Dictionary) -> void:
	capacity = size
	for key in ["x","y","z","vx","vy","vz","yaw","hp","maxHp","stateTime","flash","phase","moveBlend","spin","spinVel","cooldown","ring","side","scale","dist2"]:
		var values = PackedFloat32Array()
		values.resize(capacity)
		set(key, values)
	for key in ["state","kind","alive","engaged","token"]:
		var values = PackedByteArray()
		values.resize(capacity)
		set(key, values)
	hitStamp.resize(capacity)
	random = M.rng(seed)
	setPressure(profile)

func randomRange(low: float, high: float) -> float:
	return low + (high - low) * random.call()

func setPressure(profile: Dictionary, distance: float = -1.0, attacker_limit: int = -1) -> void:
	difficulty = profile
	engageRange = profile.engageRange if distance < 0 else distance
	maxAttackers = int(profile.maxAttackers) if attacker_limit < 0 else attacker_limit

func reset(spawns: Array) -> void:
	assert(spawns.size() <= capacity, "Enemy count exceeds capacity")
	count = spawns.size()
	aliveCount = count
	attackers = 0
	engageTimer = 0
	tokenTimer = 0
	kills.clear()
	strikes.clear()
	for i in range(count):
		var s: Dictionary = spawns[i]
		var captain: bool = int(s.kind) == 2
		x[i] = s.x
		y[i] = 0
		z[i] = s.z
		vx[i] = 0
		vy[i] = 0
		vz[i] = 0
		yaw[i] = s.yaw
		kind[i] = int(s.kind)
		hp[i] = 230 * difficulty.captainHp if captain else randomRange(40, 52)
		maxHp[i] = hp[i]
		state[i] = State.Formation
		stateTime[i] = random.call() * 2
		flash[i] = 0
		phase[i] = random.call() * TAU
		moveBlend[i] = 0
		spin[i] = 0
		spinVel[i] = 0
		cooldown[i] = randomRange(0.5, 3)
		ring[i] = 3
		side[i] = -1 if random.call() < 0.5 else 1
		scale[i] = 1.22 if captain else randomRange(0.96, 1.04)
		alive[i] = 1
		engaged[i] = 0
		token[i] = 0
		hitStamp[i] = 0
	rebuildHash()

func update(dt: float, px: float, py: float, pz: float, arena: Variant) -> void:
	strikes.clear()
	engageTimer -= dt
	if engageTimer <= 0:
		engageTimer = 0.2
		assignEngagement(px, pz)
	assignTokens(dt, px, pz)
	for i in range(count):
		if alive[i] == 0: continue
		flash[i] = maxf(0, flash[i] - dt * 9)
		cooldown[i] -= dt
		stateTime[i] += dt
		step(i, dt, px, py, pz)
		var speed: float = sqrt(vx[i] * vx[i] + vz[i] * vz[i])
		moveBlend[i] = M.damp(moveBlend[i], minf(1, speed / 3.5), 10, dt)
		phase[i] += speed * dt * 2.3
	rebuildHash()
	separate(px, pz, arena)

func applyHit(stamp: int, win: Dictionary, ax: float, ay: float, az: float, facing: float, out: Array) -> void:
	var ids: Array = hash_grid.query(ax, az, M.shapeReach(win.shape) + BODY_RADIUS * 1.5 + 0.5)
	var fx: float = sin(facing)
	var fz: float = cos(facing)
	var offset: float = win.shape.get("offset", 0.0)
	var cx: float = ax + fx * offset
	var cz: float = az + fz * offset
	var low_y: float = ay + win.get("yMin", -0.6)
	var high_y: float = ay + win.get("yMax", 2.6)
	for i in ids:
		if alive[i] == 0 or hitStamp[i] == stamp: continue
		if y[i] < low_y or y[i] > high_y: continue
		if not M.inHitShape(win.shape, ax, az, facing, x[i], z[i], BODY_RADIUS * scale[i]): continue
		hitStamp[i] = stamp
		var dir_x: float = fx
		var dir_z: float = fz
		if win.get("radial", false):
			var dx: float = x[i] - cx
			var dz: float = z[i] - cz
			var distance: float = sqrt(dx * dx + dz * dz)
			if distance > 0.001:
				dir_x = dx / distance
				dir_z = dz / distance
		var killed: bool = damage(i, win, dir_x, dir_z)
		out.append({"id":i,"x":x[i],"y":y[i],"z":z[i],"dirX":dir_x,"dirZ":dir_z,"killed":killed})

func nearest(px: float, pz: float, max_distance: float) -> int:
	var best: int = -1
	var best_distance: float = max_distance * max_distance
	for i in hash_grid.query(px, pz, max_distance):
		if alive[i] == 0: continue
		var dx: float = x[i] - px
		var dz: float = z[i] - pz
		var distance: float = dx * dx + dz * dz
		if distance < best_distance:
			best_distance = distance
			best = i
	return best

func step(i: int, dt: float, px: float, py: float, pz: float) -> void:
	var t: float = stateTime[i]
	match state[i]:
		State.Formation:
			brake(i, dt, 8)
			var dx: float = px - x[i]
			var dz: float = pz - z[i]
			if dx * dx + dz * dz < 2000: yaw[i] = M.dampAngle(yaw[i], atan2(dx, dz), 1.5, dt)
			if engaged[i] == 1: setState(i, State.Engage)
		State.March:
			var dx: float = px - x[i]
			var dz: float = pz - z[i]
			var distance: float = sqrt(dx * dx + dz * dz)
			if distance == 0: distance = 1
			vx[i] = M.damp(vx[i], dx / distance * 2.8, 4, dt)
			vz[i] = M.damp(vz[i], dz / distance * 2.8, 4, dt)
			yaw[i] = M.dampAngle(yaw[i], atan2(dx, dz), 6, dt)
			if engaged[i] == 1: setState(i, State.Engage)
		State.Engage: engage(i, dt, px, pz)
		State.Windup:
			brake(i, dt, 10)
			yaw[i] = M.dampAngle(yaw[i], atan2(px - x[i], pz - z[i]), 8, dt)
			if t >= (0.85 if kind[i] == 2 else 0.55) * difficulty.windup: strike(i, px, py, pz)
		State.Strike:
			brake(i, dt, 6)
			if t >= 0.14: setState(i, State.Recover)
		State.Recover:
			brake(i, dt, 8)
			if t >= 0.5:
				releaseToken(i)
				cooldown[i] = randomRange(2.5, 5.5)
				setState(i, State.Engage)
		State.Flinch:
			brake(i, dt, 5)
			if t >= 0.42: recover(i)
		State.Air:
			vy[i] -= 25 * dt
			x[i] += vx[i] * dt
			y[i] += vy[i] * dt
			z[i] += vz[i] * dt
			spin[i] += spinVel[i] * dt
			if y[i] <= 0 and vy[i] <= 0:
				y[i] = 0
				vy[i] = 0
				vx[i] *= 0.35
				vz[i] *= 0.35
				setState(i, State.Down)
			return
		State.Knockback:
			brake(i, dt, 5)
			if t >= 0.4: recover(i)
		State.Down:
			brake(i, dt, 6)
			if t >= 1.15: setState(i, State.Getup)
		State.Getup:
			brake(i, dt, 10)
			if t >= 0.5: recover(i)
	x[i] += vx[i] * dt
	z[i] += vz[i] * dt

func engage(i: int, dt: float, px: float, pz: float) -> void:
	var dx: float = x[i] - px
	var dz: float = z[i] - pz
	var distance: float = maxf(sqrt(dx * dx + dz * dz), 0.001)
	var nx: float = dx / distance
	var nz: float = dz / distance
	var has_token: bool = token[i] == 1
	var error: float = distance - (1.55 if has_token else ring[i])
	var speed: float = maxf(-2.5, minf(error * 2.2, 5.2 if error > 3 else 3.2))
	var tx: float = -nx * speed
	var tz: float = -nz * speed
	if not has_token and absf(error) < 1.5:
		tx += -nz * side[i] * 0.9
		tz += nx * side[i] * 0.9
	vx[i] = M.damp(vx[i], tx, 6, dt)
	vz[i] = M.damp(vz[i], tz, 6, dt)
	yaw[i] = M.dampAngle(yaw[i], atan2(-dx, -dz), 9, dt)
	if has_token and distance < 1.9: setState(i, State.Windup)

func strike(i: int, px: float, py: float, pz: float) -> void:
	setState(i, State.Strike)
	var captain: bool = kind[i] == 2
	vx[i] = sin(yaw[i]) * 2.2
	vz[i] = cos(yaw[i]) * 2.2
	var dx: float = px - x[i]
	var dz: float = pz - z[i]
	if sqrt(dx * dx + dz * dz) < (2.9 if captain else 2.4) and py < 1.4 and absf(M.wrapAngle(atan2(dx, dz) - yaw[i])) < 1.0:
		strikes.append({"damage":(70 if captain else 26) * difficulty.enemyDamage,"heavy":captain,"x":x[i],"z":z[i]})

func damage(i: int, win: Dictionary, dir_x: float, dir_z: float) -> bool:
	var captain: bool = kind[i] == 2
	var push: float = win.push * (0.6 if captain else 1.0)
	var lift: float = 0.7 if captain else 1.0
	hp[i] -= win.damage
	flash[i] = 1
	releaseToken(i)
	if hp[i] <= 0:
		alive[i] = 0
		state[i] = State.Dead
		aliveCount -= 1
		kills.append({"id":i,"x":x[i],"y":y[i],"z":z[i],"vx":dir_x * push * 0.8 + vx[i] * 0.3,"vy":maxf(win.lift, 2.5) * 0.8,"vz":dir_z * push * 0.8 + vz[i] * 0.3,"yaw":yaw[i],"spin":spin[i],"kind":kind[i]})
		return true
	var airborne: bool = state[i] == State.Air
	yaw[i] = atan2(-dir_x, -dir_z)
	match win.reaction:
		"flinch":
			if airborne:
				vy[i] = maxf(vy[i], 3.2)
				vx[i] = dir_x * push * 0.4
				vz[i] = dir_z * push * 0.4
			elif not (captain and state[i] == State.Windup and random.call() < 0.5):
				setState(i, State.Flinch)
				vx[i] = dir_x * push
				vz[i] = dir_z * push
		"launch":
			vy[i] = maxf(vy[i], win.lift * 0.75) if airborne else win.lift * lift
			vx[i] = dir_x * push
			vz[i] = dir_z * push
			spinVel[i] = -randomRange(3, 6)
			if not airborne: enterAir(i)
		"knockback":
			vx[i] = dir_x * push
			vz[i] = dir_z * push
			if airborne: vy[i] = maxf(vy[i], 2.5)
			else: setState(i, State.Knockback)
		"blowaway":
			vy[i] = maxf(win.lift, 3) * lift
			vx[i] = dir_x * push
			vz[i] = dir_z * push
			spinVel[i] = -randomRange(9, 14)
			if not airborne: enterAir(i)
		"knockdown":
			vx[i] = dir_x * push * (0.5 if airborne else 1.0)
			vz[i] = dir_z * push * (0.5 if airborne else 1.0)
			if airborne: vy[i] = -10
			else: setState(i, State.Down)
	return false

func enterAir(i: int) -> void:
	setState(i, State.Air)
	spin[i] = 0
	y[i] = maxf(y[i], 0.01)

func assignEngagement(px: float, pz: float) -> void:
	var order: Array = []
	for i in range(count):
		if alive[i] == 0: continue
		var dx: float = x[i] - px
		var dz: float = z[i] - pz
		dist2[i] = dx * dx + dz * dz
		order.append(i)
	order.sort_custom(func(a, b): return dist2[a] < dist2[b] if dist2[a] != dist2[b] else a < b)
	var engaged_count: int = 0
	for i in order:
		var distance: float = sqrt(dist2[i])
		var keep: bool = engaged[i] == 1 and distance < 42
		if engaged_count < 54 and (distance < engageRange or keep):
			engaged[i] = 1
			ring[i] = 2.7 + 1.25 * floor(float(engaged_count) / 9.0)
			engaged_count += 1
		elif engaged[i] == 1:
			engaged[i] = 0
			releaseToken(i)
			if state[i] == State.Engage: setState(i, State.March)
	var need: int = 20 - engaged_count
	for i in order:
		if need <= 0: break
		if engaged[i] == 1: continue
		if state[i] == State.Formation: setState(i, State.March)
		if state[i] == State.March: need -= 1

func assignTokens(dt: float, px: float, pz: float) -> void:
	tokenTimer -= dt
	if tokenTimer > 0 or attackers >= maxAttackers: return
	var best: int = -1
	var best_distance: float = 64
	for i in range(count):
		if alive[i] == 0 or engaged[i] == 0 or token[i] == 1: continue
		if state[i] != State.Engage or cooldown[i] > 0: continue
		var dx: float = x[i] - px
		var dz: float = z[i] - pz
		var distance: float = dx * dx + dz * dz
		if distance < best_distance:
			best_distance = distance
			best = i
	if best >= 0:
		token[best] = 1
		attackers += 1
		tokenTimer = randomRange(0.2, 0.6)

func separate(px: float, pz: float, arena: Variant) -> void:
	for i in range(count):
		if alive[i] == 0: continue
		if state[i] != State.Air:
			for j in hash_grid.query(x[i], z[i], 1.1):
				if j <= i or alive[j] == 0 or state[j] == State.Air: continue
				var dx: float = x[j] - x[i]
				var dz: float = z[j] - z[i]
				var d2: float = dx * dx + dz * dz
				var minimum: float = (scale[i] + scale[j]) * BODY_RADIUS
				if d2 >= minimum * minimum: continue
				if d2 < 1e-6:
					x[j] += 0.02 * side[j]
					continue
				var distance: float = sqrt(d2)
				var push: float = (minimum - distance) / distance * 0.5
				x[i] -= dx * push
				z[i] -= dz * push
				x[j] += dx * push
				z[j] += dz * push
			var dx: float = x[i] - px
			var dz: float = z[i] - pz
			var d2: float = dx * dx + dz * dz
			if d2 < 0.9 and d2 > 1e-6:
				var distance: float = sqrt(d2)
				x[i] = px + dx / distance * 0.95
				z[i] = pz + dz / distance * 0.95
		var point: Vector3 = arena.constrain(Vector3(x[i], 0, z[i]), BODY_RADIUS * scale[i])
		x[i] = point.x
		z[i] = point.z

func rebuildHash() -> void:
	hash_grid.clear()
	for i in range(count):
		if alive[i] == 1: hash_grid.insert(i, x[i], z[i])

func setState(i: int, value: int) -> void:
	state[i] = value
	stateTime[i] = 0

func recover(i: int) -> void:
	setState(i, State.Engage if engaged[i] == 1 else State.March)

func brake(i: int, dt: float, rate: float) -> void:
	vx[i] = M.damp(vx[i], 0, rate, dt)
	vz[i] = M.damp(vz[i], 0, rate, dt)

func releaseToken(i: int) -> void:
	if token[i] == 1:
		token[i] = 0
		attackers = maxi(0, attackers - 1)
