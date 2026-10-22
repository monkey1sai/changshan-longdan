extends SceneTree

var cases: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run_cases")

func record_case(name: String, passed: bool) -> void:
	cases.append({"name": name, "pass": passed})

func run_cases() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	var values: Dictionary = {}
	var index: int = 0
	while index + 1 < args.size():
		values[args[index]] = args[index + 1]
		index += 2
	if not values.has("--report") or not values.has("--run-id") or not values.has("--candidate"):
		printerr("G01_TEST_ARGUMENTS_MISSING")
		quit(2)
		return
	var started: float = Time.get_unix_time_from_system() * 1000.0
	var packed = load("res://scenes/bootstrap.tscn")
	record_case("bootstrap_scene_loads", packed is PackedScene)
	if packed is PackedScene:
		var scene = packed.instantiate()
		root.add_child(scene)
		await process_frame
		record_case("main_scene_matches_configuration", ProjectSettings.get_setting("application/run/main_scene") == "res://scenes/game.tscn")
		record_case("toolchain_scope_is_visible", scene.get_node("HUD/Panel/VBox/Status").text.contains("NOT THE PORTED GAME"))
		record_case("counter_starts_at_zero", scene.get("click_count") == 0 and scene.get_node("HUD/Panel/VBox/Counter").text == "Verified clicks: 0")
		scene.get_node("HUD/Panel/VBox/CountButton").pressed.emit()
		record_case("button_changes_visible_counter", scene.get("click_count") == 1 and scene.get_node("HUD/Panel/VBox/Counter").text == "Verified clicks: 1")
		scene.get_node("HUD/Panel/VBox/CountButton").pressed.emit()
		record_case("second_press_accumulates_once", scene.get("click_count") == 2 and scene.get_node("HUD/Panel/VBox/Counter").text == "Verified clicks: 2")
		if scene.has_method("configure_platform_actions"):
			scene.call("configure_platform_actions", "Web")
			record_case("web_has_no_unsupported_app_quit", not scene.get_node("HUD/Panel/VBox/QuitButton").visible)
			scene.call("configure_platform_actions", "Windows")
			record_case("windows_app_quit_is_available", scene.get_node("HUD/Panel/VBox/QuitButton").visible)
		else:
			record_case("web_has_no_unsupported_app_quit", false)
			record_case("windows_app_quit_is_available", false)
		record_case("compatibility_renderer_configured", ProjectSettings.get_setting("rendering/renderer/rendering_method") == "gl_compatibility")
		var state: Dictionary = scene.call("runtime_state")
		var identity: Dictionary = state.get("build", {})
		record_case("staged_build_identity_matches_run", identity.get("candidate") == values["--candidate"] and identity.get("runId") == values["--run-id"])
		scene.queue_free()
		await process_frame
	if FileAccess.file_exists("res://tests/gameplay.gd"):
		var gameplay_suite = load("res://tests/gameplay.gd").new()
		var gameplay_cases = await gameplay_suite.run()
		cases.append_array(gameplay_cases)
	if FileAccess.file_exists("res://tests/presentation.gd"):
		var presentation_suite = load("res://tests/presentation.gd").new()
		cases.append_array(await presentation_suite.run())
	var failures: int = 0
	for item in cases:
		if not item["pass"]:
			failures += 1
	var report: Dictionary = {
		"schemaVersion": 1, "runId": values["--run-id"], "candidate": values["--candidate"],
		"startedAtMs": started, "finishedAtMs": Time.get_unix_time_from_system() * 1000.0,
		"total": cases.size(), "passed": cases.size() - failures, "failed": failures, "skipped": 0, "cases": cases
	}
	var file = FileAccess.open(values["--report"], FileAccess.WRITE)
	if file == null:
		printerr("G01_TEST_REPORT_WRITE_FAILED")
		quit(2)
		return
	file.store_string(JSON.stringify(report))
	file.close()
	print("G01_TEST_SUMMARY " + JSON.stringify(report))
	quit(0 if failures == 0 else 1)
