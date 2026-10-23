extends Node3D
## Source-baked procedural skin. No animation owns combat timing or root motion.
const MODEL_PATH = "res://assets/zhaoyun.glb"
const DATA_PATH = "res://data/presentation.json"
static var sharedData: Dictionary = {}
var assetStatus: String = "failed"
var error: String = ""
var skeleton: Skeleton3D
var weapon: Node3D
var data: Dictionary
var boneIndices: Array = []
var skeletonFromRoot: Transform3D
var meshFromDriver: Transform3D
var current: Array = []
var transitionFrom: Array = []
var lastKey: String = ""
var lastMoveTime: float = -1.0
var blend: float = 1.0
var tip: Vector3
var tipBase: Vector3
var lastSampleTime: float = 0.0
var skinMeshes: Array = []
var skinBindings: Array = []
var flashMaterial: StandardMaterial3D

func descendants(node: Node) -> Array:
	var result: Array = [node]
	for child in node.get_children(): result.append_array(descendants(child))
	return result

func relative_transform(node: Node3D) -> Transform3D:
	var result: Transform3D = node.transform
	var parent: Node = node.get_parent()
	while parent != self and parent is Node3D:
		result = parent.transform * result
		parent = parent.get_parent()
	return result

func _init(model_path: String = MODEL_PATH, data_path: String = DATA_PATH) -> void:
	name = "ZhaoYunSkin"
	if model_path != MODEL_PATH or data_path != DATA_PATH:
		error = "Only the manifest-bound local asset is accepted"
		return
	if not ResourceLoader.exists(model_path) or not FileAccess.file_exists(data_path):
		error = "Original model or source motion data missing"
		return
	var packed = load(model_path)
	if sharedData.is_empty(): sharedData = JSON.parse_string(FileAccess.get_file_as_string(data_path))
	var value = sharedData
	if not packed is PackedScene or not value is Dictionary:
		error = "Invalid model or motion manifest"
		return
	data = value
	var scene = packed.instantiate()
	add_child(scene)
	for node in descendants(scene):
		if node is Skeleton3D: skeleton = node
		if node.name == "SM_ZhaoYunSpear": weapon = node
		if node is MeshInstance3D and node.skin != null: skinMeshes.append(node)
	if skeleton == null or weapon == null or skinMeshes.is_empty() or data.bones.size() != 21:
		error = "Required skeleton, skinned body or spear missing"
		scene.queue_free()
		return
	for bone_name in data.bones:
		var index: int = skeleton.find_bone(bone_name)
		if index < 0:
			error = "Required bone missing: " + bone_name
			scene.queue_free()
			return
		boneIndices.append(index)
	skeletonFromRoot = relative_transform(skeleton).affine_inverse()
	for mesh in skinMeshes:
		# Skin bind poses are mutable per character, never mutate the imported cache.
		mesh.skin = mesh.skin.duplicate(true)
		var binding: Dictionary = {"skin":mesh.skin,"original":[],"bones":[]}
		for i in range(mesh.skin.get_bind_count()):
			var bone_name: String = mesh.skin.get_bind_name(i)
			var index: int = skeleton.find_bone(bone_name) if bone_name != "" else mesh.skin.get_bind_bone(i)
			if index < 0 or not index in boneIndices:
				error = "Invalid imported skin bind"
				return
			binding.original.append(mesh.skin.get_bind_pose(i))
			binding.bones.append(index)
		skinBindings.append(binding)
	meshFromDriver = unpack_transform(data.weaponLocal).affine_inverse()
	weapon.owner = null
	weapon.reparent(self, false)
	flashMaterial = StandardMaterial3D.new()
	flashMaterial.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flashMaterial.albedo_color = Color(1,0.85,0.65)
	assetStatus = "ready"
	reset()

static func unpack_transform(values: Array) -> Transform3D:
	return Transform3D(Basis(Vector3(values[0],values[1],values[2]),Vector3(values[3],values[4],values[5]),Vector3(values[6],values[7],values[8])),Vector3(values[9],values[10],values[11]))

static func mix_transform(a: Transform3D, b: Transform3D, weight: float) -> Transform3D:
	# Full affine interpolation retains source shear. Transform.interpolate_with decomposes it.
	var result: Transform3D = Transform3D(Basis(a.basis.x.lerp(b.basis.x,weight),a.basis.y.lerp(b.basis.y,weight),a.basis.z.lerp(b.basis.z,weight)),a.origin.lerp(b.origin,weight))
	# Opposed rotations can collapse a linear basis. Keep the nearer full source
	# basis in that exceptional transition instead of passing a singular pose to Skin.
	if absf(result.basis.determinant()) < 0.02:
		result.basis = a.basis if weight < 0.5 else b.basis
	return result

func sample_track(track_name: String, at: float) -> Array:
	var track: Dictionary = data.tracks[track_name]
	var t: float = clampf(at,0,track.duration)
	var a: int = 0
	var high: int = track.times.size()-1
	while a < high:
		var mid: int = (a+high+1)/2
		if track.times[mid] <= t: a = mid
		else: high = mid-1
	var b: int = mini(a+1,track.frames.size()-1)
	var u: float = clampf((t-track.times[a])/maxf(0.0000001,track.times[b]-track.times[a]),0,1)
	var result: Array = []
	for i in range(22):
		result.append(mix_transform(unpack_transform(track.frames[a][i]),unpack_transform(track.frames[b][i]),u))
	# Blend a short loop tail to its first pose, including the history-dependent cape.
	if track.loop and t > track.duration-0.08:
		var weight: float = smoothstep(track.duration-0.08,track.duration,t)
		for i in range(22): result[i] = mix_transform(result[i],unpack_transform(track.frames[0][i]),weight)
	return result

func reset() -> void:
	lastKey = ""
	lastMoveTime = -1
	blend = 1
	transitionFrom.clear()
	if assetStatus == "ready":
		current = sample_track("idle",0)
		apply_pose(current)

func apply_pose(pose: Array) -> void:
	for value in pose:
		if not value.is_finite() or absf(value.basis.determinant()) < 0.00001:
			assetStatus = "failed"
			error = "Invalid source skin transform"
			return
	# Parent-first traversal handles any importer bone order rather than relying on names.
	var pending: Array = boneIndices.duplicate()
	var applied: Array = []
	while not pending.is_empty():
		for index in pending.duplicate():
			var parent: int = skeleton.get_bone_parent(index)
			if parent >= 0 and parent in pending: continue
			skeleton.set_bone_global_pose(index,skeletonFromRoot * pose[boneIndices.find(index)])
			applied.append(index)
			pending.erase(index)
	# Godot joints store TRS; Three's nonuniform parent scales also generate shear.
	# Per-bind residual correction preserves native skin deformation exactly:
	# actual * (actual^-1 * desired * originalBind) == desired * originalBind.
	for binding in skinBindings:
		for i in range(binding.bones.size()):
			var index: int = binding.bones[i]
			var actual: Transform3D = skeleton.get_bone_global_pose(index)
			var desired: Transform3D = skeletonFromRoot * pose[boneIndices.find(index)]
			if absf(actual.basis.determinant()) < 0.00001:
				assetStatus = "failed"
				error = "Singular skin transform"
				return
			binding.skin.set_bind_pose(i,actual.affine_inverse()*desired*binding.original[i])
	weapon.transform = pose[21]
	tip = pose[21] * meshFromDriver * Vector3(0,0,2.7)
	tipBase = pose[21] * meshFromDriver * Vector3(0,0,1.25)

func update(player: Variant, sim_dt: float, hurt_flash: bool = false) -> void:
	position = player.pos
	rotation.y = player.facing
	if assetStatus != "ready": return
	for mesh in skinMeshes: mesh.material_overlay = flashMaterial if hurt_flash else null
	if sim_dt <= 0 and lastKey != "": return
	var key: String = player.state
	var at: float = player.stateTime
	if player.move != null:
		key = player.move.id + ("_air" if player.pos.y > 0.25 else "")
		at = player.moveTime
	elif key == "move":
		key = "idle" if player.speed < 0.3 else ("walk" if player.speed < 5.55 else "run")
		at = fposmod(player.runPhase,TAU*5)/(data.tracks[key].speed*1.25) if key != "idle" else fposmod(player.stateTime,2.0)
	elif key == "dodge" and player.dodgeBack: key = "dodge_back"
	if not data.tracks.has(key): key = "idle"
	if data.tracks[key].loop: at = fposmod(at,data.tracks[key].duration)
	var target: Array = sample_track(key,at)
	var restarted: bool = player.move != null and player.moveTime < lastMoveTime
	if key != lastKey or restarted:
		transitionFrom = current.duplicate()
		blend = 0 if lastKey != "" else 1
		lastKey = key
	blend = minf(1,blend+sim_dt/(0.14 if key in ["idle","walk","run","jump"] else 0.07))
	current = target
	if blend < 1:
		for i in range(22): current[i] = mix_transform(transitionFrom[i],target[i],smoothstep(0,1,blend))
	lastMoveTime = player.moveTime if player.move != null else -1
	lastSampleTime = at
	apply_pose(current)
