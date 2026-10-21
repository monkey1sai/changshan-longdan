extends Node3D
const BattleModel = preload("res://core/battle.gd")
const NativeInput = preload("res://scripts/game_input.gd")
const CameraModel = preload("res://scripts/camera_rig.gd")
const Presentation = preload("res://scripts/game_view.gd")
var reference: Dictionary
var battle: Variant
var controls: Variant
var rig: Variant
var view: Node3D
var mode: String = "title"
var selectedDifficulty: String = "normal"
var clock: float = 0.0
var endTimer: float = 0.0
var resultShown: bool = false
var difficultySelect: OptionButton
var startButton: Button
var resumeButton: Button
var retryButton: Button
var quitButton: Button
var hudLabel: Label
var resultLabel: Label
var titlePanel: PanelContainer
var pausePanel: PanelContainer
var resultPanel: PanelContainer
var ui: Control

func _ready() -> void:
	reference = JSON.parse_string(FileAccess.get_file_as_string("res://data/reference.json"))
	battle = BattleModel.new(reference)
	controls = NativeInput.new()
	rig = CameraModel.new()
	view = Presentation.new(reference)
	add_child(view)
	add_child(rig.camera)
	rig.snap(battle.player.pos,battle.player.facing)
	build_ui()
	configure_platform_actions(OS.get_name())
	view.update(battle,0)
	rig.update(1.0/60.0,battle.player.pos,0,0,false,true,0)
	update_hud()
	print("G02_READY " + JSON.stringify({"build":build_identity(),"mode":mode,"soldiers":battle.enemies.aliveCount,"assetStatus":view.assetStatus}))

func build_identity() -> Dictionary:
	if FileAccess.file_exists("res://build_identity.json"):
		var value = JSON.parse_string(FileAccess.get_file_as_string("res://build_identity.json"))
		if value is Dictionary: return value
	return {"candidate":"editor-unbound","scope":"development project, not frozen acceptance artifact"}

func label(parent: Node, text: String, font_size: int = 18) -> Label:
	var node = Label.new()
	node.text = text
	node.add_theme_font_size_override("font_size",font_size)
	parent.add_child(node)
	return node

func button(parent: Node, text: String, action: Callable) -> Button:
	var node = Button.new()
	node.text = text
	node.custom_minimum_size = Vector2(440,38)
	node.pressed.connect(action)
	parent.add_child(node)
	return node

func panel(title: String) -> PanelContainer:
	var node = PanelContainer.new()
	node.set_anchors_preset(Control.PRESET_CENTER)
	node.offset_left = -250
	node.offset_right = 250
	node.offset_top = -180
	node.offset_bottom = 180
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.035,0.055,0.085,0.96)
	style.set_content_margin_all(22)
	node.add_theme_stylebox_override("panel",style)
	ui.add_child(node)
	var column = VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation",12)
	node.add_child(column)
	label(column,title,28)
	return node

func build_ui() -> void:
	var canvas = CanvasLayer.new()
	canvas.name = "HUD"
	add_child(canvas)
	ui = Control.new()
	ui.name = "Interface"
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(ui)
	hudLabel = label(ui,"",20)
	hudLabel.position = Vector2(18,14)
	hudLabel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var help = label(ui,"WASD / arrows: move   J / left mouse: attack   K / right mouse: charge   L: musou\nSpace: jump   Shift: dodge   F: guard   Q/E: camera   Wheel: zoom   R: recenter   Esc/P: pause",14)
	help.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	help.offset_left = 18
	help.offset_top = -58
	help.mouse_filter = Control.MOUSE_FILTER_IGNORE
	titlePanel = panel("CHANGSHAN LONGDAN")
	var column = titlePanel.get_node("Column")
	label(column,"Godot native gameplay development",19)
	label(column,"300 soldiers / 17 moves / four difficulties",16)
	difficultySelect = OptionButton.new()
	for id in reference.difficulties: difficultySelect.add_item(id.capitalize())
	difficultySelect.select(1)
	column.add_child(difficultySelect)
	difficultySelect.focus_entered.connect(func(): controls.clear())
	startButton = button(column,"To Battle!  [Enter / J]",func(): start_battle())
	quitButton = button(column,"Quit",quit_native)
	var note = label(column,"Procedural fallback art; original character, audio and final visual migration are pending.",14)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	pausePanel = panel("PAUSED")
	resumeButton = button(pausePanel.get_node("Column"),"Resume [Esc / P / Enter]",func(): set_paused(false))
	pausePanel.visible = false
	resultPanel = panel("BATTLE RESULT")
	resultLabel = label(resultPanel.get_node("Column"),"",20)
	retryButton = button(resultPanel.get_node("Column"),"Retry [Enter]",func(): start_battle())
	resultPanel.visible = false

func configure_platform_actions(platform_name: String) -> void:
	quitButton.visible = platform_name != "Web"

func quit_native() -> void:
	if OS.has_feature("web"): return
	print("G02_QUIT " + JSON.stringify({"build":build_identity(),"mode":mode,"ko":battle.ko}))
	get_tree().quit(0)

func start_battle(clear_input: bool = true) -> void:
	if mode == "title": selectedDifficulty = reference.difficulties.keys()[difficultySelect.selected]
	if clear_input: controls.clear()
	battle.reset(selectedDifficulty)
	mode = "playing"
	endTimer = 0
	resultShown = false
	titlePanel.visible = false
	pausePanel.visible = false
	resultPanel.visible = false
	rig.snap(battle.player.pos,battle.player.facing)
	update_hud()
	print("G02_BATTLE_START " + JSON.stringify({"difficulty":selectedDifficulty,"soldiers":battle.enemies.aliveCount}))

func set_paused(paused: bool) -> void:
	if paused and mode != "playing": return
	if not paused and mode != "paused": return
	mode = "paused" if paused else "playing"
	controls.clear()
	battle.interrupt()
	pausePanel.visible = paused

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and controls != null:
		controls.clear()
		set_paused(true)

func _input(event: InputEvent) -> void:
	if controls == null: return
	if mode == "title" and event is InputEventKey and difficultySelect.has_focus() and event.physical_keycode not in [KEY_J,KEY_ENTER]:
		controls.clear()
		return
	if not event is InputEventMouseButton or mode == "playing": controls.accept_event(event)
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode in [KEY_J,KEY_ENTER] and mode == "title":
		get_viewport().set_input_as_handled()

func _physics_process(delta: float) -> void:
	var dt: float = minf(0.05,delta)
	tick(dt,controls.sample(dt))

func tick(real_dt: float, frame: Dictionary) -> void:
	clock += real_dt
	match mode:
		"title":
			if frame.get("confirm",false) or frame.get("attack",false): start_battle(false)
		"playing":
			if frame.get("pause",false): set_paused(true)
		"paused":
			if frame.get("pause",false) or frame.get("confirm",false): set_paused(false)
		"ended":
			if resultShown and frame.get("confirm",false): start_battle(false)
	var sim_dt: float = 0
	if mode in ["playing","ended"]:
		if mode == "playing" and frame.get("recenter",false): rig.recenter(battle.player.facing)
		sim_dt = battle.step(real_dt,rig.to_controls(frame))
		if mode == "ended":
			endTimer -= real_dt
			if endTimer <= 0 and not resultShown:
				resultShown = true
				var result: Dictionary = battle.result()
				resultLabel.text = "%s  /  Rank %s\nKO %d / 300    Max combo %d\nTime %.1fs    Damage %.1f" % ["VICTORY" if result.win else "DEFEAT",result.rank,result.ko,result.maxCombo,result.seconds,result.damage]
				resultPanel.visible = true
		for event in battle.events:
			if event.type in ["victory","defeat"]:
				mode = "ended"
				endTimer = 2.4
			elif event.type == "hit": rig.addTrauma(event.window.shake)
			elif event.type == "hurt": rig.addTrauma(0.45)
	view.update(battle,sim_dt)
	rig.update(real_dt,battle.player.pos,frame.get("camTurn",0.0) if mode=="playing" else 0.0,frame.get("zoom",0.0),battle.player.state=="musou",mode=="title",clock)
	update_hud()

func update_hud() -> void:
	var p = battle.player
	hudLabel.visible = mode != "title"
	hudLabel.text = "HP %.0f / %.0f     MUSOU %.0f / 100     KO %d / 300\nENEMIES %d    COMBO %d    TIME %.1fs    %s\n%s  /  %s    [procedural fallback]" % [p.hp,p.maxHp,p.musou,battle.ko,battle.enemies.aliveCount,battle.combo,battle.battleTime,p.move.id if p.move!=null else p.state,battle.difficulty,battle.phase]
