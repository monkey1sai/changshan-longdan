extends RefCounted
const M = preload("res://core/sim_math.gd")
var camera: Camera3D = Camera3D.new()
var yaw: float = PI
var distance: float = 9.2
var focus: Vector3 = Vector3.ZERO
var forward: Vector3 = Vector3(0,0,-1)
var right: Vector3 = Vector3.RIGHT
var zoomedDistance: float = 9.2
var titleMix: float = 1.0
var musouMix: float = 0.0
var recenterYaw: Variant = null
var trauma: float = 0.0
var punch: float = 0.0

func _init() -> void:
	camera.name = "FollowCamera"
	camera.fov = 55
	camera.near = 0.1
	camera.far = 1500
	camera.current = true

func snap(target: Vector3, direction: float) -> void:
	yaw = direction
	recenterYaw = null
	forward = Vector3(sin(yaw),0,cos(yaw))
	right = Vector3(-cos(yaw),0,sin(yaw))
	focus = target + Vector3(0,1.35,0)

func recenter(direction: float) -> void:
	recenterYaw = direction

func addTrauma(amount: float) -> void:
	trauma = minf(1, trauma + amount)

func kick(amount: float) -> void:
	punch = maxf(punch, amount)

func to_controls(frame: Dictionary) -> Dictionary:
	var mx: float = forward.x * frame.get("moveY",0.0) + right.x * frame.get("moveX",0.0)
	var mz: float = forward.z * frame.get("moveY",0.0) + right.z * frame.get("moveX",0.0)
	var length: float = sqrt(mx * mx + mz * mz)
	if length > 1:
		mx /= length
		mz /= length
	var out: Dictionary = {"moveX":mx,"moveZ":mz}
	for action in ["attack","charge","jump","dodge","musou","guard"]: out[action] = frame.get(action,false)
	return out

func update(dt: float, target: Vector3, turn: float, zoom: float, musou: bool, title: bool, time: float) -> void:
	yaw -= turn * 2.4 * dt
	if absf(turn) > 0.01: recenterYaw = null
	if recenterYaw != null: yaw = M.dampAngle(yaw,recenterYaw,10,dt)
	distance = clampf(distance + zoom * 0.7,5.5,13)
	zoomedDistance = M.damp(zoomedDistance,distance,10,dt)
	titleMix = M.damp(titleMix,1 if title else 0,2.2,dt)
	musouMix = M.damp(musouMix,1 if musou else 0,5,dt)
	focus.x = M.damp(focus.x,target.x,10,dt)
	focus.z = M.damp(focus.z,target.z,10,dt)
	focus.y = M.damp(focus.y,target.y+1.35,6,dt)
	forward = Vector3(sin(yaw),0,cos(yaw))
	right = Vector3(-cos(yaw),0,sin(yaw))
	var direction: float = yaw + musouMix * sin(time*0.6)*0.45
	var far_distance: float = lerpf(zoomedDistance,11,musouMix)
	var desired: Vector3 = Vector3(clampf(focus.x-sin(direction)*far_distance,-55.5,55.5),maxf(0.6,focus.y+lerpf(4.4,4.8,musouMix)),clampf(focus.z-cos(direction)*far_distance,-55.5,55.5))
	var look: Vector3 = Vector3(focus.x,focus.y+0.15+musouMix*1.2,focus.z)
	var up: Vector3 = Vector3.UP
	if titleMix > 0.001:
		var angle: float = time * 0.045
		desired = desired.lerp(Vector3(sin(angle)*78,38,cos(angle)*78),titleMix)
		look = look.lerp(Vector3(0,4,-6),titleMix)
	else: up = Vector3(sin(direction),0,cos(direction))
	camera.position = desired
	camera.look_at(look,up)
	var strength: float = trauma * trauma
	if strength > 0.0001:
		var t: float = time * 32
		camera.translate_object_local(Vector3((sin(t*1.3)+sin(t*2.7+1.1)*0.5)*0.28*strength,(sin(t*1.7+2.3)+sin(t*3.1)*0.5)*0.22*strength,0))
		camera.rotate_object_local(Vector3(0,0,1),sin(t*2.1+0.7)*0.035*strength)
	trauma = maxf(0,trauma-dt*1.5)
	punch = maxf(0,punch-dt*6)
	camera.fov = lerpf(55,60,musouMix)+titleMix*5-punch*4
