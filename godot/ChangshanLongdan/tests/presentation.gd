extends RefCounted
var cases: Array[Dictionary] = []
var skinChanges: int = 0
func skin_changed() -> void:
	skinChanges += 1
func check(label: String, passed: bool) -> void:
	cases.append({"name":"presentation_"+label,"pass":passed})
	if not passed: print("PRESENTATION_FAIL "+label)

func transform_close(a: Transform3D, b: Transform3D, tolerance: float = 0.001) -> bool:
	return a.origin.distance_to(b.origin)<tolerance and a.basis.x.distance_to(b.basis.x)<tolerance and a.basis.y.distance_to(b.basis.y)<tolerance and a.basis.z.distance_to(b.basis.z)<tolerance

func run() -> Array[Dictionary]:
	var Hero = load("res://scripts/character_view.gd")
	var hero = Hero.new()
	var root: Window = Engine.get_main_loop().root
	root.add_child(hero)
	check("original_skin_ready",hero.assetStatus == "ready" and hero.skeleton.get_bone_count() == 21)
	var invalid = Hero.new("res://assets/absent.glb")
	check("missing_asset_never_ready",invalid.assetStatus == "failed" and invalid.error != "")
	invalid.free()
	check("skin_inverse_binds_present",not hero.skinMeshes.is_empty() and hero.skinMeshes[0].skin.get_bind_count()==21)
	var textured: bool = false
	for mesh in hero.skinMeshes:
		for i in range(mesh.mesh.get_surface_count()):
			var mat = mesh.get_active_material(i)
			if mat is BaseMaterial3D and mat.albedo_texture != null: textured = true
	check("original_embedded_texture_imported",textured)
	var other = Hero.new()
	root.add_child(other)
	check("instance_skin_isolation",hero.skinMeshes[0].skin != other.skinMeshes[0].skin)
	var binds_ok: bool = true
	for binding in hero.skinBindings:
		for i in range(binding.bones.size()):
			var bone_name: String = hero.skeleton.get_bone_name(binding.bones[i])
			binds_ok = binds_ok and transform_close(binding.original[i],Hero.unpack_transform(hero.data.inverseBinds[bone_name]),0.0001)
	check("imported_inverse_binds_match_original_source",binds_ok)
	var skin_reference = hero.skinMeshes[0].get_skin_reference()
	check("mesh_skin_reference_uses_instance_skin",skin_reference != null and skin_reference.get_skin()==hero.skinMeshes[0].skin)
	hero.skinMeshes[0].skin.changed.connect(skin_changed,CONNECT_ONE_SHOT)
	var native_pose: Array = hero.sample_track("N1",0.12)
	hero.apply_pose(native_pose)
	hero.skeleton.force_update_all_bone_transforms()
	await Engine.get_main_loop().process_frame
	check("bind_updates_emit_skin_changed",skinChanges>0)
	var can_read_render: bool = skin_reference != null and skin_reference.get_skeleton().is_valid()
	var native_ok: bool = can_read_render
	if can_read_render:
		var binding: Dictionary = hero.skinBindings[0]
		for i in range(binding.bones.size()):
			var desired: Transform3D = hero.skeletonFromRoot*native_pose[hero.boneIndices.find(binding.bones[i])]*binding.original[i]
			native_ok = native_ok and transform_close(RenderingServer.skeleton_bone_get_transform(skin_reference.get_skeleton(),i),desired,0.0001)
		check("rendering_server_receives_corrected_skin",native_ok)
	else:
		print("G03_RENDER_READBACK NOT_RUN: headless Dummy backend has no skeleton RID; CPU/resource wiring only")
		check("dummy_backend_identified",DisplayServer.get_name()=="headless")
	hero.apply_pose(hero.sample_track("C4",0.25))
	hero.reset()
	hero.skeleton.force_update_all_bone_transforms()
	await Engine.get_main_loop().process_frame
	var reset_ok: bool = true
	for binding in hero.skinBindings:
		for i in range(binding.bones.size()):
			var desired: Transform3D = hero.skeletonFromRoot*hero.current[hero.boneIndices.find(binding.bones[i])]*binding.original[i]
			var actual: Transform3D = hero.skeleton.get_bone_global_pose(binding.bones[i])*binding.skin.get_bind_pose(i)
			reset_ok = reset_ok and transform_close(actual,desired,0.0001)
	check("reset_has_no_accumulated_bind_correction",reset_ok)
	check("second_instance_unaffected",other.current==other.sample_track("idle",0))
	other.free()
	var opposed: Transform3D = Hero.mix_transform(Transform3D.IDENTITY,Transform3D(Basis(Vector3.UP,PI),Vector3.ZERO),0.5)
	check("opposed_transition_never_singular",opposed.is_finite() and absf(opposed.basis.determinant())>=0.02)
	var probes: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tests/presentation_probes.json"))
	for n in range(probes.probes.size()):
		var probe: Dictionary = probes.probes[n]
		var pose: Array = hero.sample_track(probe.track,probe.time)
		hero.apply_pose(pose)
		var positions_ok: bool = true
		var bases_ok: bool = true
		for i in range(21):
			var expected: Transform3D = Hero.unpack_transform(probe.frame[i])
			var history_dependent: bool = probe.get("offGrid",false) and hero.data.bones[i] in ["cape_01","cape_02"]
			if not history_dependent:
				positions_ok = positions_ok and pose[i].origin.distance_to(expected.origin)<0.025
				bases_ok = bases_ok and pose[i].basis.x.distance_to(expected.basis.x)<0.08 and pose[i].basis.y.distance_to(expected.basis.y)<0.08 and pose[i].basis.z.distance_to(expected.basis.z)<0.08
			var binding: Dictionary = hero.skinBindings[0]
			var bind_index: int = binding.bones.find(hero.boneIndices[i])
			var actual: Transform3D = hero.skeleton.get_bone_global_pose(hero.boneIndices[i])*binding.skin.get_bind_pose(bind_index)
			check("skin_deformation_"+str(n)+"_"+str(i),transform_close(actual,hero.skeletonFromRoot*pose[i]*binding.original[bind_index],0.0001))
		check("source_positions_"+str(n),positions_ok)
		check("source_rotations_"+str(n),bases_ok)
		check("source_spear_mesh_"+str(n),pose[21].origin.distance_to(Hero.unpack_transform(probe.frame[21]).origin)<0.025)
		check("source_tip_"+str(n),hero.tip.distance_to(Vector3(probe.tips[0][0],probe.tips[0][1],probe.tips[0][2]))<0.04)
		check("source_trail_base_"+str(n),hero.tipBase.distance_to(Vector3(probe.tips[1][0],probe.tips[1][1],probe.tips[1][2]))<0.04)
	var reference: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/reference.json"))
	var battle = load("res://core/battle.gd").new(reference)
	var p = battle.player
	p.pos = Vector3(5,0.7,-8)
	p.facing = 1.2
	p.state = "attack"
	p.move = reference.moves.N5
	p.moveTime = 0.3
	hero.reset()
	hero.update(p,1.0/60)
	check("core_owns_root_and_facing",hero.position==p.pos and is_equal_approx(hero.rotation.y,p.facing))
	check("air_variant_selected",hero.lastKey=="N5_air")
	var previous: Array = hero.current.duplicate()
	p.moveTime = 0.4
	hero.update(p,0)
	check("hitstop_freezes_pose",hero.current==previous and hero.lastSampleTime==0.3)
	p.moveTime = 0.01
	hero.update(p,1.0/60)
	check("same_move_restart_blends",hero.blend<1 and hero.lastSampleTime==0.01)
	var transitions_ok: bool = true
	for state in ["MUSOU","down","N4","dead","move"]:
		p.state = "musou" if state=="MUSOU" else ("attack" if state=="N4" else state)
		p.move = reference.moves[state] if reference.moves.has(state) else null
		for i in range(10):
			p.stateTime = 0.4+i/60.0
			p.moveTime = 2.6+i/60.0 if state=="MUSOU" else 0.3+i/60.0
			hero.update(p,1.0/60)
			transitions_ok = transitions_ok and hero.assetStatus=="ready"
	check("spin_down_dead_interruptions_remain_finite",transitions_ok)
	for track_name in ["idle","walk","run","guard","dead"]:
		var duration: float = hero.data.tracks[track_name].duration
		var first: Array = hero.sample_track(track_name,0)
		var last: Array = hero.sample_track(track_name,duration)
		var closed: bool = true
		for i in range(22): closed = closed and transform_close(first[i],last[i],0.0001)
		check("loop_seam_"+track_name,closed)
	await Engine.get_main_loop().process_frame
	hero.free()
	var game = load("res://scenes/game.tscn").instantiate()
	root.add_child(game)
	game.set_physics_process(false)
	game.start_battle()
	check("live_scene_uses_original_skin",game.view.character.assetStatus=="ready" and not game.view.playerVisual.visible)
	var original_battle = game.battle
	# Small deterministic event fixture only; never a natural 300KO/S claim.
	game.battle = load("res://core/battle.gd").new(reference,{"limit":20.0,"obstacles":[],"spawns":[{"x":0.0,"z":1.2,"yaw":PI,"kind":0}],"playerStart":{"x":0.0,"z":0.0,"facing":0.0},"capacity":320,"enemySeed":7})
	game.battle.enemies.hp[0] = 1
	for i in range(90): game.tick(1.0/60,{"attack":i==0})
	check("real_battle_hit_kill_events_reach_audio_and_effects",game.battle.ko==1 and game.audio.playedEvents>0 and game.view.effects.emitted>0)
	game.battle = original_battle
	game.start_battle()
	game.view.effects.burst(Vector3.ZERO,1000,true,true)
	check("fixed_particle_capacity",game.view.effects.pool.size()==384 and game.view.effects.particles.multimesh.instance_count==384)
	game.audio.consume([{"type":"parry"},{"type":"musouReady"}])
	check("audio_events_reach_voices",game.audio.playedEvents==2)
	game.battle.events = [{"type":"hurt"}]
	game.set_paused(true)
	var event_count: int = game.audio.playedEvents
	var particle_count: int = game.view.effects.emitted
	var frozen: Array = game.view.character.current.duplicate()
	for i in range(20): game.tick(1.0/60,{})
	check("pause_never_replays_stale_events",event_count==game.audio.playedEvents and particle_count==game.view.effects.emitted)
	check("pause_freezes_pose",frozen==game.view.character.current)
	check("pause_suspends_audio",game.audio.suspended)
	game.set_paused(false)
	check("resume_audio",not game.audio.suspended)
	for i in range(40): game.audio.play_event("hit")
	check("bounded_audio_voices",game.audio.voices.size()==12 and game.audio.get_child_count()==13)
	game.toggle_sound()
	event_count = game.audio.playedEvents
	game.audio.play_event("hit")
	check("mute_stops_sound",game.audio.muted and game.audio.playedEvents==event_count and not game.audio.music.playing)
	game.start_battle()
	check("retry_clears_particles_and_audio",game.view.effects.emitted==0 and game.audio.playedEvents==0 and game.view.effects.trailPoints.is_empty())
	check("retry_keeps_mute",game.audio.muted)
	check("enemy_telegraph_capacity",game.view.enemyThreat.multimesh.instance_count==320)
	game.view.effects.burst(Vector3.UP,5)
	game.view.effects.ring(Vector3.ZERO,2)
	game.view.effects.update(2,Vector3.ZERO,Vector3.ZERO,false)
	var cleared: bool = true
	for particle in game.view.effects.pool: cleared = cleared and particle.life==0
	for item in game.view.effects.rings: cleared = cleared and not item.node.visible
	check("effects_expire_and_hide",cleared)
	game.view.character.assetStatus = "failed"
	game.view.update(game.battle,0)
	check("runtime_asset_failure_displays_fallback",game.view.playerVisual.visible and not game.view.character.visible and game.view.assetStatus=="procedural_fallback")
	game.free()
	# AudioStreamPlayer.stop queues fade-out deletion in AudioServer. The last
	# rapid play/steal fixture must cross an actual mix before engine teardown;
	# voice-node capacity does not bound transient mixer playback references.
	var since_mix: float = AudioServer.get_time_since_last_mix()
	var drain_deadline: int = Time.get_ticks_msec()+1000
	var mixed: bool = false
	while Time.get_ticks_msec()<drain_deadline:
		await Engine.get_main_loop().create_timer(0.005).timeout
		var next_since_mix: float = AudioServer.get_time_since_last_mix()
		if next_since_mix < since_mix:
			mixed = true
			break
		since_mix = next_since_mix
	# Let the main-thread AudioServer update collect references retired by mix.
	await Engine.get_main_loop().create_timer(0.005).timeout
	check("audio_mixer_drained_before_teardown",mixed)
	return cases
