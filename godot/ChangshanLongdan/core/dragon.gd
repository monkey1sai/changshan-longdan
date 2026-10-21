extends RefCounted
const M = preload("res://core/sim_math.gd")
var definition: Dictionary
var headPos: Vector3 = Vector3.ZERO
var elapsed: float = 0.0
var active: bool = false
var startFacing: float = 0.0
var center: Vector3 = Vector3.ZERO
var hitTimer: float = 0.0
var stamp: int = 0
var striking: bool:
	get: return active and elapsed > definition.start and elapsed < definition.end

func _init(data: Dictionary) -> void:
	definition = data

func start(origin: Vector3, facing: float) -> void:
	active = true
	elapsed = 0
	startFacing = facing
	center = origin
	hitTimer = 0

func stop() -> void:
	active = false

func update(dt: float, origin: Vector3, facing: float) -> void:
	if not active: return
	elapsed += dt
	if elapsed >= definition.duration:
		stop()
		return
	center = origin
	headPos = headAt(elapsed, facing)
	if striking:
		hitTimer -= dt
		if hitTimer <= 0:
			hitTimer = definition.interval
			stamp = M.next_stamp()

func spiral(t: float) -> Vector3:
	var angle: float = startFacing + PI + t * 4.6
	var u: float = 1.0 - minf(1, t / 0.5)
	var grow: float = 1.0 - u * u * u
	var radius: float = 1.2 + 4.6 * grow + sin(t * 3) * 0.6 * grow
	return Vector3(center.x + sin(angle) * radius, 0.5 + 3.2 * grow + sin(t * 5.2) * 1.1 * grow, center.z + cos(angle) * radius)

func headAt(t: float, facing: float) -> Vector3:
	if t < definition.end: return spiral(t)
	var fx: float = sin(facing)
	var fz: float = cos(facing)
	var apex: Vector3 = Vector3(center.x + fx * 3, 15, center.z + fz * 3)
	var impact: Vector3 = Vector3(center.x + fx * 6, 0, center.z + fz * 6)
	if t < 2.95: return spiral(definition.end).lerp(apex, M.smoothstep(0, 1, (t - definition.end) / 0.4))
	if t < 3.1:
		var u: float = (t - 2.95) / 0.15
		return apex.lerp(impact, u * u)
	var u: float = (t - 3.1) / 0.5
	return Vector3(impact.x + fx * 3 * u, -5 * u, impact.z + fz * 3 * u)
