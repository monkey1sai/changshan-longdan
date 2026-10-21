extends RefCounted
const P = preload("res://core/player.gd")
const E = preload("res://core/enemies.gd")
const D = preload("res://core/dragon.gd")
const A = preload("res://core/arena.gd")
var reference: Dictionary
var setup: Dictionary
var arena: Variant
var player: Variant
var enemies: Variant
var dragon: Variant
var events: Array = []
var hits: Array = []
var kills: Array = []
var profile: Dictionary
var phase: String = "opening"
var outcome: String = "ongoing"
var spawnCount: int = 0
var hitstop: float = 0.0
var slowmo: float = 0.0
var battleTime: float = 0.0
var combo: int = 0
var comboTimer: float = 0.0
var maxCombo: int = 0
var ko: int = 0
var damageTaken: float = 0.0
var musouWasReady: bool = false
var difficulty: String:
	get: return profile.id
var comboTime: float:
	get: return maxf(0, comboTimer) / 2.4

func _init(data: Dictionary, custom_setup: Dictionary = {}) -> void:
	reference = data
	setup = custom_setup if not custom_setup.is_empty() else {"limit":data.layout.limit,"obstacles":data.layout.obstacles,"spawns":data.spawns,"playerStart":data.playerStart,"capacity":data.capacity,"enemySeed":7}
	arena = A.new(setup.limit, setup.obstacles)
	player = P.new(data.moves)
	profile = data.difficulties.normal
	enemies = E.new(int(setup.capacity), int(setup.get("enemySeed", 7)), profile)
	dragon = D.new(data.dragon)
	reset()

func reset(selected: String = "") -> void:
	if selected == "": selected = profile.id
	profile = reference.difficulties[selected]
	var start: Dictionary = setup.playerStart
	player.reset(start.x, start.z, start.facing)
	phase = "opening"
	enemies.setPressure(profile)
	enemies.reset(setup.spawns)
	dragon.stop()
	spawnCount = setup.spawns.size()
	outcome = "ongoing"
	hitstop = 0
	slowmo = 0
	battleTime = 0
	combo = 0
	comboTimer = 0
	maxCombo = 0
	ko = 0
	damageTaken = 0
	musouWasReady = false
	events.clear()
	hits.clear()
	kills.clear()

func interrupt() -> void:
	player.clearQueuedActions()

func aim(x: float, z: float, distance: float) -> Variant:
	var i: int = enemies.nearest(x, z, distance)
	return null if i < 0 else {"x":enemies.x[i],"z":enemies.z[i]}

func step(real_dt: float, controls: Dictionary) -> float:
	events.clear()
	hits.clear()
	kills.clear()
	var active: bool = outcome == "ongoing"
	var c: Dictionary = controls if active else {}
	if hitstop > 0:
		hitstop -= real_dt
		player.queue(c)
		return 0
	if slowmo > 0: slowmo -= real_dt
	var dt: float = real_dt * (0.3 if slowmo > 0 else 1.0)
	if active: battleTime += dt
	player.update(dt, c, aim, arena)
	updatePressure()
	enemies.update(dt, player.pos.x, player.pos.y, player.pos.z, arena)
	forwardPlayerEvents()
	resolvePlayerHits()
	updateDragon(dt)
	resolveKills()
	for strike in enemies.strikes: resolveStrike(strike)
	comboTimer -= dt
	if comboTimer <= 0: combo = 0
	checkOutcome()
	var ready: bool = player.musouReady
	if ready and not musouWasReady and outcome == "ongoing": events.append({"type":"musouReady"})
	musouWasReady = ready
	return dt

static func rank_result(r: Dictionary) -> String:
	if not r.win:
		return "B" if r.ko >= 200 else ("C" if r.ko >= 100 else "D")
	if r.seconds < 300 and r.damage < 400: return "S"
	if r.seconds < 480: return "A"
	return "B"

func result() -> Dictionary:
	var r: Dictionary = {"win":outcome == "victory","ko":ko,"maxCombo":maxCombo,"seconds":battleTime,"damage":damageTaken}
	r.rank = rank_result(r)
	return r

func updatePressure() -> void:
	var current: Dictionary = reference.phases[0]
	for candidate in reference.phases:
		if ko >= candidate.minKo: current = candidate
	enemies.setPressure(profile, profile.engageRange + current.engageBonus, int(profile.maxAttackers + current.attackerBonus))
	if current.id != phase:
		phase = current.id
		events.append({"type":"phase","id":phase})

func forwardPlayerEvents() -> void:
	for event in player.events:
		if event.type in ["guardBlock","parry","hurt","death"]: continue
		if event.type == "musouStart": dragon.start(player.pos, player.facing)
		events.append(event)

func resolvePlayerHits() -> void:
	for h in player.activeHits:
		var start: int = hits.size()
		enemies.applyHit(h.stamp,h.window,h.x,h.y,h.z,h.facing,hits)
		var count: int = hits.size() - start
		if count == 0: continue
		hitstop = maxf(hitstop, h.window.hitstop)
		addCombo(count)
		player.gainMusou(minf(9, count * 1.4))
		events.append({"type":"hit","window":h.window,"start":start,"count":count})

func updateDragon(dt: float) -> void:
	if not dragon.active: return
	dragon.update(dt, player.pos, player.facing)
	if not dragon.striking: return
	var head: Vector3 = dragon.headPos
	var start: int = hits.size()
	enemies.applyHit(dragon.stamp,reference.dragon.hit,head.x,head.y,head.z,0,hits)
	var count: int = hits.size() - start
	if count == 0: return
	addCombo(count)
	events.append({"type":"dragonHit","start":start,"count":count,"x":head.x,"z":head.z})

func resolveKills() -> void:
	if enemies.kills.is_empty(): return
	var before: int = ko
	var start: int = kills.size()
	kills.append_array(enemies.kills)
	events.append({"type":"kill","start":start,"count":enemies.kills.size()})
	ko += enemies.kills.size()
	enemies.kills.clear()
	if enemies.aliveCount == 0: return
	var half: int = int(ceil(spawnCount / 2.0))
	if floor(before / 100.0) < floor(ko / 100.0): events.append({"type":"milestone","ko":int(floor(ko / 100.0)) * 100})
	elif before < half and ko >= half: events.append({"type":"halfDefeated"})

func resolveStrike(strike: Dictionary) -> void:
	events.append({"type":"enemyStrike","x":strike.x,"z":strike.z,"heavy":strike.heavy})
	var hp_before: float = player.hp
	var event_start: int = player.events.size()
	var hurt: bool = player.takeHit(strike.damage,strike.heavy,strike.x,strike.z)
	var event = player.events[event_start] if player.events.size() > event_start else null
	damageTaken += hp_before - player.hp
	if player.hp > 0 and event != null and event.type == "parry":
		hitstop = maxf(hitstop, 0.06)
		events.append({"type":"parry","x":strike.x,"z":strike.z,"facing":player.facing})
		return
	if player.hp > 0 and event != null and event.type == "guardBlock":
		events.append({"type":"guardBlock","x":strike.x,"z":strike.z,"facing":player.facing,"heavy":strike.heavy,"damage":event.damage})
		return
	if not hurt: return
	if combo > 0: events.append({"type":"comboBreak"})
	combo = 0
	comboTimer = 0
	events.append({"type":"hurt","x":strike.x,"z":strike.z,"heavy":strike.heavy})

func checkOutcome() -> void:
	if outcome != "ongoing": return
	if enemies.aliveCount == 0:
		outcome = "victory"
		slowmo = 1.6
		events.append({"type":"victory"})
	elif player.state == "dead":
		outcome = "defeat"
		slowmo = 1.2
		events.append({"type":"defeat"})

func addCombo(count: int) -> void:
	combo += count
	comboTimer = 2.4
	maxCombo = maxi(maxCombo, combo)
