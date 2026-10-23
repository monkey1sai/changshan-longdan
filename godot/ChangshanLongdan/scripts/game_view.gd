extends Node3D
# Read-only native presentation. Original Zhao Yun; procedural environment/enemies.
const Character = preload("res://scripts/character_view.gd")
const Effects = preload("res://scripts/battle_effects.gd")
var assetStatus: String = "procedural_fallback"
var character: Node3D
var effects: Node3D
var enemyThreat: MultiMeshInstance3D
var reference: Dictionary
var enemyMeshes: Dictionary = {}
var obstacleMeshes: Array = []
var playerVisual: Node3D
var playerMaterial: StandardMaterial3D
var dragonRoot: Node3D
var dragonParts: Array = []
var dragonHistory: Array = []
var hurtFlash: float = 0.0

func material(color: Color, instance_colors: bool = false) -> StandardMaterial3D:
	var value = StandardMaterial3D.new()
	value.albedo_color = color
	value.roughness = 0.9
	value.vertex_color_use_as_albedo = instance_colors
	return value

func box(parent: Node3D, label: String, size: Vector3, origin: Vector3, surface: Material) -> MeshInstance3D:
	var node = MeshInstance3D.new()
	node.name = label
	var mesh = BoxMesh.new()
	mesh.size = size
	mesh.material = surface
	node.mesh = mesh
	node.position = origin
	parent.add_child(node)
	return node

func _init(data: Dictionary) -> void:
	reference = data
	name = "BattlePresentation"
	var environment = WorldEnvironment.new()
	var settings = Environment.new()
	settings.background_mode = Environment.BG_COLOR
	settings.background_color = Color(0.13,0.1,0.14)
	settings.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	settings.ambient_light_color = Color(0.72,0.8,1)
	settings.ambient_light_energy = 0.65
	environment.environment = settings
	add_child(environment)
	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42,-28,0)
	sun.light_color = Color(1,0.82,0.63)
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	add_child(sun)
	box(self,"Ground",Vector3(128,0.3,128),Vector3(0,-0.15,0),material(Color(0.21,0.25,0.22)))
	var stone = material(Color(0.3,0.32,0.35))
	box(self,"WestWall",Vector3(6,9,124),Vector3(-59,4.5,0),stone)
	box(self,"EastWall",Vector3(6,9,124),Vector3(59,4.5,0),stone)
	box(self,"NorthWall",Vector3(112,9,6),Vector3(0,4.5,-59),stone)
	box(self,"SouthWallLeft",Vector3(50,9,6),Vector3(-31,4.5,59),stone)
	box(self,"SouthWallRight",Vector3(50,9,6),Vector3(31,4.5,59),stone)
	for i in range(data.layout.obstacles.size()):
		var o: Dictionary = data.layout.obstacles[i]
		var width: float = o.maxX-o.minX
		var depth: float = o.maxZ-o.minZ
		var height: float = o.get("height",1.3 if width<2 else (0.6 if depth<5 else 4.7))
		obstacleMeshes.append(box(self,"Obstacle"+str(i),Vector3(width,height,depth),Vector3((o.minX+o.maxX)/2,height/2,(o.minZ+o.maxZ)/2),stone))
	playerMaterial = material(Color(0.1,0.62,0.72))
	var skin = material(Color(0.84,0.7,0.52))
	var dark = material(Color(0.08,0.13,0.2))
	playerVisual = Node3D.new()
	playerVisual.name = "Player"
	add_child(playerVisual)
	box(playerVisual,"Torso",Vector3(0.7,0.8,0.42),Vector3(0,1.15,0),playerMaterial)
	box(playerVisual,"Head",Vector3(0.46,0.46,0.46),Vector3(0,1.8,0),skin)
	box(playerVisual,"Helmet",Vector3(0.52,0.16,0.52),Vector3(0,2.06,0),playerMaterial)
	box(playerVisual,"LeftArm",Vector3(0.22,0.72,0.25),Vector3(-0.46,1.1,0),playerMaterial)
	box(playerVisual,"RightArm",Vector3(0.22,0.72,0.25),Vector3(0.46,1.1,0),playerMaterial)
	box(playerVisual,"LeftLeg",Vector3(0.26,0.7,0.3),Vector3(-0.22,0.36,0),dark)
	box(playerVisual,"RightLeg",Vector3(0.26,0.7,0.3),Vector3(0.22,0.36,0),dark)
	var weapon = Node3D.new()
	weapon.name = "Weapon"
	weapon.position = Vector3(0.48,1.25,0)
	playerVisual.add_child(weapon)
	box(weapon,"Shaft",Vector3(0.065,0.065,3.0),Vector3(0,0,1.0),material(Color(0.43,0.25,0.12)))
	box(weapon,"Blade",Vector3(0.16,0.07,0.6),Vector3(0,0,2.7),material(Color(0.8,0.91,0.94)))
	for pair in [["tip",3.0],["tipBase",2.4]]:
		var marker = Node3D.new()
		marker.name = pair[0]
		marker.position.z = pair[1]
		weapon.add_child(marker)
	var white = material(Color.WHITE,true)
	for spec in [["body",Vector3(.65,.8,.4)],["head",Vector3(.44,.44,.44)],["leg_l",Vector3(.24,.7,.28)],["leg_r",Vector3(.24,.7,.28)],["weapon",Vector3(.07,2.1,.07)]]:
		var node = MultiMeshInstance3D.new()
		node.name = "Soldiers_"+spec[0]
		var mesh = BoxMesh.new()
		mesh.size = spec[1]
		mesh.material = white
		var multi = MultiMesh.new()
		multi.transform_format = MultiMesh.TRANSFORM_3D
		multi.use_colors = true
		multi.mesh = mesh
		multi.instance_count = int(data.capacity)
		node.multimesh = multi
		enemyMeshes[spec[0]] = node
		add_child(node)
	dragonRoot = Node3D.new()
	dragonRoot.name = "DragonFallback"
	add_child(dragonRoot)
	for i in range(16):
		var node = MeshInstance3D.new()
		var mesh = SphereMesh.new()
		mesh.radius = 0.65 if i==0 else 0.4
		mesh.height = mesh.radius * 2
		mesh.radial_segments = 8
		mesh.rings = 4
		mesh.material = material(Color(0.15,0.85,0.55))
		node.mesh = mesh
		dragonParts.append(node)
		dragonRoot.add_child(node)
	dragonRoot.visible = false
	character = Character.new()
	add_child(character)
	if character.assetStatus == "ready":
		assetStatus = "zhaoyun_ready_environment_procedural"
		playerVisual.visible = false
	effects = Effects.new()
	add_child(effects)
	# One additional instanced mesh for all windup telegraphs.
	enemyThreat = MultiMeshInstance3D.new()
	enemyThreat.name = "EnemyWindupTelegraphs"
	var ring_mesh = TorusMesh.new()
	ring_mesh.inner_radius = 0.55
	ring_mesh.outer_radius = 0.63
	ring_mesh.rings = 16
	ring_mesh.ring_segments = 4
	ring_mesh.material = material(Color.WHITE,true)
	var markers = MultiMesh.new()
	markers.transform_format = MultiMesh.TRANSFORM_3D
	markers.use_colors = true
	markers.mesh = ring_mesh
	markers.instance_count = int(data.capacity)
	enemyThreat.multimesh = markers
	add_child(enemyThreat)

func reset() -> void:
	character.reset()
	effects.reset()
	dragonHistory.clear()
	dragonRoot.visible = false
	hurtFlash = 0

func consume(events: Array, battle: Variant) -> void:
	for event in events:
		if event.type == "hurt": hurtFlash = 0.18
	effects.consume(events,battle)

func update(battle: Variant, sim_dt: float) -> void:
	var p = battle.player
	playerVisual.position = p.pos
	playerVisual.rotation.y = p.facing
	var walk: float = sin(p.runPhase * 2.0) * minf(1,p.speed/7.4)
	playerVisual.get_node("LeftLeg").rotation.x = walk * 0.5
	playerVisual.get_node("RightLeg").rotation.x = -walk * 0.5
	var weapon = playerVisual.get_node("Weapon")
	weapon.rotation = Vector3.ZERO
	if p.move != null:
		weapon.rotation.y = sin(p.moveTime/p.move.duration*PI*2.0)*0.9
		weapon.rotation.x = -0.35
	elif p.state == "guard": weapon.rotation.z = 0.6
	hurtFlash = maxf(0,hurtFlash-sim_dt)
	playerMaterial.albedo_color = Color.WHITE if hurtFlash>0 else Color(0.1,0.62,0.72)
	character.update(p,sim_dt,hurtFlash>0)
	playerVisual.visible = character.assetStatus != "ready"
	character.visible = not playerVisual.visible
	assetStatus = "zhaoyun_ready_environment_procedural" if not playerVisual.visible else "procedural_fallback"
	var tip_world: Vector3 = p.pos + Basis(Vector3.UP,p.facing)*character.tip
	var base_world: Vector3 = p.pos + Basis(Vector3.UP,p.facing)*character.tipBase
	effects.update(sim_dt,tip_world,base_world,p.move != null and not p.activeHits.is_empty())
	var e = battle.enemies
	for i in range(int(reference.capacity)):
		var present: bool = i < e.count and e.alive[i] == 1
		var basis = Basis(Vector3.UP,e.yaw[i]) * Basis(Vector3.RIGHT,e.spin[i]) if present else Basis.IDENTITY
		basis = basis.scaled(Vector3.ONE * (e.scale[i] if present else 0.001))
		var origin = Vector3(e.x[i],e.y[i],e.z[i]) if present else Vector3(0,-1000,0)
		var stride: float = sin(e.phase[i])*e.moveBlend[i]*0.18 if present else 0.0
		var color: Color = Color(0.77,0.2,0.16)
		if present:
			if e.kind[i]==2: color = Color(0.95,0.6,0.14)
			elif e.kind[i]==1: color = Color(0.43,0.31,0.64)
			if e.state[i]==3: color = Color(1,0.65,0.12)
			color = color.lerp(Color.WHITE,e.flash[i])
		var offsets = {"body":Vector3(0,1.12,0),"head":Vector3(0,1.76,0),"leg_l":Vector3(-.21,.36,stride),"leg_r":Vector3(.21,.36,-stride),"weapon":Vector3(.5,1.15,.25)}
		for key in enemyMeshes:
			var limb = Basis.IDENTITY
			if present:
				if key == "leg_l": limb = Basis(Vector3.RIGHT,sin(e.phase[i])*e.moveBlend[i]*0.55)
				elif key == "leg_r": limb = Basis(Vector3.RIGHT,-sin(e.phase[i])*e.moveBlend[i]*0.55)
				elif key == "weapon":
					var windup: float = clampf(e.stateTime[i]*3.0,0,1) if e.state[i]==3 else 0.0
					limb = Basis(Vector3.RIGHT,-0.7-windup*0.8 if e.state[i]!=4 else 0.9)
			var transform = Transform3D(basis,origin) * Transform3D(limb,offsets[key])
			enemyMeshes[key].multimesh.set_instance_transform(i,transform)
			enemyMeshes[key].multimesh.set_instance_color(i,color)
		var warning: bool = present and e.state[i] == 3
		enemyThreat.multimesh.set_instance_transform(i,Transform3D(Basis.IDENTITY.scaled(Vector3.ONE*(e.scale[i] if warning else 0.001)),Vector3(e.x[i],0.04,e.z[i]) if warning else Vector3(0,-1000,0)))
		enemyThreat.multimesh.set_instance_color(i,Color(1,0.12,0.04) if e.kind[i]==2 else Color(1,0.7,0.06))
	dragonRoot.visible = battle.dragon.active
	if battle.dragon.active:
		if sim_dt>0 or dragonHistory.is_empty(): dragonHistory.push_front(battle.dragon.headPos)
		while dragonHistory.size()>48: dragonHistory.pop_back()
		for i in range(dragonParts.size()): dragonParts[i].position = dragonHistory[mini(i*2,dragonHistory.size()-1)]
	else: dragonHistory.clear()
