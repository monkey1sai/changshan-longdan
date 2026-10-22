extends Node3D
## Fixed pools, independent RNG, view-only event consumption.
const PARTICLE_LIMIT = 384
const RING_LIMIT = 24
const TRAIL_LIMIT = 24
var particles: MultiMeshInstance3D
var pool: Array = []
var rings: Array = []
var trail: MeshInstance3D
var trailPoints: Array = []
var random = RandomNumberGenerator.new()
var cursor: int = 0
var ringCursor: int = 0
var emitted: int = 0

func surface(color: Color) -> StandardMaterial3D:
	var value = StandardMaterial3D.new()
	value.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	value.vertex_color_use_as_albedo = true
	value.albedo_color = color
	value.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	value.cull_mode = BaseMaterial3D.CULL_DISABLED
	return value

func _init() -> void:
	name = "BattleEffects"
	random.seed = 73021
	particles = MultiMeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = Vector3.ONE
	mesh.material = surface(Color.WHITE)
	var multi = MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.use_colors = true
	multi.mesh = mesh
	multi.instance_count = PARTICLE_LIMIT
	particles.multimesh = multi
	add_child(particles)
	for i in range(PARTICLE_LIMIT):
		pool.append({"life":0.0,"duration":1.0,"pos":Vector3.ZERO,"vel":Vector3.ZERO,"size":0.1,"color":Color.WHITE})
	for i in range(RING_LIMIT):
		var node = MeshInstance3D.new()
		var torus = TorusMesh.new()
		torus.inner_radius = 0.94
		torus.outer_radius = 1.0
		torus.rings = 24
		torus.ring_segments = 4
		torus.material = surface(Color(1,0.7,0.22,0.8))
		node.mesh = torus
		node.visible = false
		add_child(node)
		rings.append({"node":node,"life":0.0,"duration":0.4,"radius":2.0})
	trail = MeshInstance3D.new()
	trail.mesh = ImmediateMesh.new()
	trail.material_override = surface(Color(0.3,0.9,1,0.55))
	add_child(trail)
	reset()

func reset() -> void:
	for i in range(PARTICLE_LIMIT):
		pool[i].life = 0.0
		particles.multimesh.set_instance_transform(i,Transform3D(Basis.IDENTITY.scaled(Vector3.ONE*0.001),Vector3(0,-1000,0)))
	for item in rings:
		item.life = 0.0
		item.node.visible = false
	trailPoints.clear()
	trail.mesh.clear_surfaces()
	cursor = 0
	ringCursor = 0
	emitted = 0
	random.seed = 73021

func burst(origin: Vector3, count: int, heavy: bool = false, fragment: bool = false) -> void:
	for i in range(mini(count,PARTICLE_LIMIT)):
		var item: Dictionary = pool[cursor]
		cursor = (cursor+1)%PARTICLE_LIMIT
		item.life = random.randf_range(0.35,0.9) if fragment else random.randf_range(0.12,0.3)
		item.duration = item.life
		item.pos = origin
		item.vel = Vector3(random.randf_range(-1,1),random.randf_range(0.2,1),random.randf_range(-1,1))*(6 if heavy else 3)
		item.size = random.randf_range(0.07,0.18) if fragment else random.randf_range(0.025,0.08)
		item.color = Color(0.55,0.2,0.14) if fragment else (Color(1,0.6,0.1) if heavy else Color(0.65,0.95,1))
		emitted += 1

func ring(origin: Vector3, radius: float) -> void:
	var item: Dictionary = rings[ringCursor]
	ringCursor = (ringCursor+1)%RING_LIMIT
	item.life = item.duration
	item.radius = radius
	item.node.position = Vector3(origin.x,0.08,origin.z)
	item.node.visible = true
	item.node.scale = Vector3(0.1,0.1,0.1)

func consume(events: Array, battle: Variant) -> void:
	for event in events:
		match event.type:
			"hit", "dragonHit":
				for i in range(int(event.start),int(event.start+event.count)):
					var hit: Dictionary = battle.hits[i]
					burst(Vector3(hit.x,hit.y+1.1,hit.z),8,event.type == "hit" and event.window.sfx == "heavy")
			"kill":
				for i in range(int(event.start),int(event.start+event.count)):
					var kill: Dictionary = battle.kills[i]
					burst(Vector3(kill.x,kill.y+0.8,kill.z),12,true,true)
			"parry", "guardBlock", "hurt":
				burst(battle.player.pos+Vector3.UP*1.2,18,event.type == "parry")
				if event.type == "parry": ring(battle.player.pos,2.4)
			"land", "dodge": burst(battle.player.pos,8)
			"fx": ring(Vector3(event.x,0,event.z),event.radius)
			"musouStart": ring(battle.player.pos,5)

func update(dt: float, tip: Vector3, base: Vector3, active_trail: bool) -> void:
	if dt <= 0: return
	for i in range(pool.size()):
		var item: Dictionary = pool[i]
		if item.life <= 0: continue
		item.life = maxf(0,item.life-dt)
		item.vel.y -= 12*dt
		item.pos += item.vel*dt
		if item.pos.y < 0.03:
			item.pos.y = 0.03
			item.vel.y = absf(item.vel.y)*0.25
		var size: float = item.size*minf(1,item.life*8)
		particles.multimesh.set_instance_transform(i,Transform3D(Basis.IDENTITY.scaled(Vector3.ONE*maxf(size,0.001)),item.pos if item.life>0 else Vector3(0,-1000,0)))
		particles.multimesh.set_instance_color(i,item.color)
	for item in rings:
		if item.life <= 0: continue
		item.life = maxf(0,item.life-dt)
		item.node.visible = item.life>0
		var radius: float = maxf(0.01,(1-item.life/item.duration)*item.radius)
		item.node.scale = Vector3(radius,0.3,radius)
	for point in trailPoints: point.life -= dt
	trailPoints = trailPoints.filter(func(point): return point.life>0)
	if active_trail: trailPoints.push_front({"tip":tip,"base":base,"life":0.16})
	while trailPoints.size()>TRAIL_LIMIT: trailPoints.pop_back()
	trail.mesh.clear_surfaces()
	if trailPoints.size()>1:
		trail.mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
		for point in trailPoints:
			trail.mesh.surface_set_color(Color(1,1,1,point.life/0.16))
			trail.mesh.surface_add_vertex(point.tip)
			trail.mesh.surface_add_vertex(point.base)
		trail.mesh.surface_end()
