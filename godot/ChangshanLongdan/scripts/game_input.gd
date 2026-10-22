extends RefCounted
# Godot native semantic button enums differ from browser Gamepad numeric indices.
const PAD_BUTTONS = {"attack":JOY_BUTTON_X,"charge":JOY_BUTTON_Y,"musou":JOY_BUTTON_B,"jump":JOY_BUTTON_A,"confirm":JOY_BUTTON_A,"dodge":JOY_BUTTON_RIGHT_SHOULDER,"guard":JOY_BUTTON_LEFT_SHOULDER,"pause":JOY_BUTTON_START,"recenter":JOY_BUTTON_RIGHT_STICK}
const KEYS = {"move_left":[KEY_A,KEY_LEFT],"move_right":[KEY_D,KEY_RIGHT],"move_forward":[KEY_W,KEY_UP],"move_back":[KEY_S,KEY_DOWN],"cam_left":[KEY_Q],"cam_right":[KEY_E],"attack":[KEY_J],"charge":[KEY_K],"musou":[KEY_L],"jump":[KEY_SPACE],"dodge":[KEY_SHIFT],"guard":[KEY_F],"pause":[KEY_ESCAPE,KEY_P],"confirm":[KEY_ENTER],"recenter":[KEY_R]}
const ACTIONS = ["attack","charge","jump","dodge","musou","pause","confirm","recenter"]
var previous: Dictionary = {}
var padPrevious: Dictionary = {}
var pressed: Dictionary = {}
var attackRepeat: float = 0.0
var wheel: float = 0.0
var mouseAttack: bool = false

func _init() -> void:
	for key in KEYS:
		var name: String = "cld_" + key
		if InputMap.has_action(name): continue
		InputMap.add_action(name)
		for code in KEYS[key]:
			var event = InputEventKey.new()
			event.physical_keycode = code
			InputMap.action_add_event(name, event)
	for pair in [["attack",MOUSE_BUTTON_LEFT],["charge",MOUSE_BUTTON_RIGHT]]:
		var event = InputEventMouseButton.new()
		event.button_index = pair[1]
		# Mouse bindings are event-owned, never globally polled as keyboard actions.
		var keyboard_name: String = "cld_" + pair[0]
		for old_event in InputMap.action_get_events(keyboard_name):
			if old_event is InputEventMouseButton: InputMap.action_erase_event(keyboard_name,old_event)
		var name: String = "cld_mouse_" + pair[0]
		if not InputMap.has_action(name): InputMap.add_action(name)
		if not InputMap.action_has_event(name,event): InputMap.action_add_event(name,event)

static func deadzone(value: float) -> float:
	return 0.0 if absf(value) < 0.2 else (value - signf(value) * 0.2) / 0.8

func accept_event(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.is_action("cld_mouse_attack"):
			mouseAttack = event.pressed
			if event.pressed: pressed.attack = true
		elif event.is_action_pressed("cld_mouse_charge"): pressed.charge = true
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP: wheel -= 1
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN: wheel += 1
		return
	if event is InputEventKey and event.echo: return
	for action in ACTIONS:
		if event.is_action_pressed("cld_" + action): pressed[action] = true

func clear() -> void:
	pressed.clear()
	previous.clear()
	attackRepeat = 0
	wheel = 0
	mouseAttack = false
	for key in KEYS: Input.action_release("cld_" + key)
	# Like source clear(), keep pad previous buttons until physical release.

# Decode physical edges before merging actions (RB and RT can both dodge).
func poll_pad(buttons: Dictionary, right_trigger: float) -> Dictionary:
	var edges: Dictionary = {}
	var held: Dictionary = {}
	var trigger_down: bool = right_trigger > 0.5
	for action in PAD_BUTTONS:
		var code: int = PAD_BUTTONS[action]
		var value: bool = buttons.get(code,false)
		var edge: bool = value and not padPrevious.get(code,false)
		if action == "dodge":
			edge = edge or (trigger_down and not padPrevious.get("rightTrigger",false))
			value = value or trigger_down
		edges[action] = edge
		held[action] = value
	padPrevious = buttons.duplicate()
	padPrevious["rightTrigger"] = trigger_down
	return {"pressed":edges,"down":held}

func sample(dt: float) -> Dictionary:
	var device: int = -1
	var devices = Input.get_connected_joypads()
	if not devices.is_empty(): device = devices[0]
	var down: Dictionary = {}
	for action in ACTIONS:
		down[action] = Input.is_action_pressed("cld_" + action)
		if down[action] and not previous.get(action,false): pressed[action] = true
		previous[action] = down[action]
	down.attack = down.attack or mouseAttack
	if device >= 0:
		var buttons: Dictionary = {}
		for code in PAD_BUTTONS.values(): buttons[code] = Input.is_joy_button_pressed(device,code)
		var pad = poll_pad(buttons,Input.get_joy_axis(device,JOY_AXIS_TRIGGER_RIGHT))
		for action in ACTIONS:
			if pad.pressed[action]: pressed[action] = true
			down[action] = down[action] or pad.down[action]
	else: padPrevious.clear()
	var mx: float = Input.get_action_strength("cld_move_right") - Input.get_action_strength("cld_move_left")
	var my: float = Input.get_action_strength("cld_move_forward") - Input.get_action_strength("cld_move_back")
	var turn: float = Input.get_action_strength("cld_cam_right") - Input.get_action_strength("cld_cam_left")
	if device >= 0:
		mx += deadzone(Input.get_joy_axis(device,JOY_AXIS_LEFT_X))
		my -= deadzone(Input.get_joy_axis(device,JOY_AXIS_LEFT_Y))
		turn += deadzone(Input.get_joy_axis(device,JOY_AXIS_RIGHT_X))
	var length: float = sqrt(mx * mx + my * my)
	if length > 1:
		mx /= length
		my /= length
	var guard: bool = Input.is_action_pressed("cld_guard") or (device >= 0 and Input.is_joy_button_pressed(device,JOY_BUTTON_LEFT_SHOULDER))
	attackRepeat = maxf(0, attackRepeat - dt)
	if not down.attack: attackRepeat = 0
	elif not guard and attackRepeat == 0:
		pressed.attack = true
		attackRepeat = 0.18
	if pressed.get("charge",false):
		pressed.erase("attack")
		attackRepeat = 0.48
	var frame: Dictionary = {"moveX":mx,"moveY":my,"camTurn":clampf(turn,-1,1),"zoom":wheel,"guard":guard,"debug":false}
	for action in ACTIONS: frame[action] = pressed.get(action,false)
	pressed.clear()
	wheel = 0
	return frame
