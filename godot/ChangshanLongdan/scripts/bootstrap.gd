extends Node3D

var click_count: int = 0
@onready var counter_label: Label = $HUD/Panel/VBox/Counter

func _ready() -> void:
	$Camera3D.look_at(Vector3(0.0, 0.6, 0.0))
	$HUD/Panel/VBox/CountButton.pressed.connect(increment_counter)
	$HUD/Panel/VBox/QuitButton.pressed.connect(quit_bootstrap)
	print("G01_READY " + JSON.stringify(runtime_state()))

func increment_counter() -> void:
	click_count += 1
	counter_label.text = "Verified clicks: %d" % click_count
	print("G01_COUNTER " + JSON.stringify(runtime_state()))

func quit_bootstrap() -> void:
	print("G01_QUIT " + JSON.stringify(runtime_state()))
	get_tree().quit(0)

func runtime_state() -> Dictionary:
	var identity: Dictionary = {}
	if FileAccess.file_exists("res://build_identity.json"):
		var content = JSON.parse_string(FileAccess.get_file_as_string("res://build_identity.json"))
		if content is Dictionary:
			identity = content
	return {
		"godot_version": Engine.get_version_info().get("string", "unknown"),
		"renderer": RenderingServer.get_current_rendering_method(),
		"click_count": click_count,
		"build": identity,
		"scope": "G01 toolchain only - not gameplay or migration acceptance"
	}
