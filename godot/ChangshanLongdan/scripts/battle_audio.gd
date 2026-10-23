extends Node
## Local source-score PCM, bounded voices; never advances the simulation.
const VOICE_LIMIT = 12
const NAMES = ["swing","hit","heavy","parry","hurt","jump","land","dodge","kill","musou","ready","victory","defeat"]
var voices: Array = []
var bank: Dictionary = {}
var music: AudioStreamPlayer
var musicTracks: Dictionary = {}
var cursor: int = 0
var muted: bool = false
var suspended: bool = true
var mode: String = "title"
var playedEvents: int = 0

func _init() -> void:
	name = "BattleAudio"
	for id in NAMES: bank[id] = load("res://assets/audio/"+id+".wav")
	for id in ["title","battle"]: musicTracks[id] = load("res://assets/audio/"+id+".wav")
	for i in range(VOICE_LIMIT):
		var voice = AudioStreamPlayer.new()
		voice.volume_db = -13
		add_child(voice)
		voices.append(voice)
	music = AudioStreamPlayer.new()
	music.volume_db = -16
	add_child(music)
	music.finished.connect(func():
		if not suspended and not muted: music.play())

func begin(battle_mode: bool) -> void:
	# Called only by the actual user start/resume action, including Web audio unlock.
	set_suspended(false)
	set_mode("battle" if battle_mode else "title")

func set_mode(value: String) -> void:
	mode = value
	if music.stream != musicTracks[value]:
		music.stream = musicTracks[value]
	if not suspended and not muted and not music.playing and is_inside_tree(): music.play()

func set_muted(value: bool) -> void:
	muted = value
	for voice in voices: voice.volume_db = -80 if muted else -13
	music.volume_db = -80 if muted else -16
	if muted:
		for voice in voices: voice.stop()
		music.stop()
	elif not suspended and is_inside_tree(): music.play()

func set_suspended(value: bool) -> void:
	suspended = value
	for voice in voices: voice.stream_paused = value
	music.stream_paused = value
	if not value and not muted and not music.playing and music.stream != null and is_inside_tree(): music.play()

func reset() -> void:
	for voice in voices:
		voice.stop()
		voice.stream_paused = false
	cursor = 0
	playedEvents = 0
	music.stop()
	music.stream_paused = false

func play_event(id: String) -> void:
	if muted or suspended or not bank.has(id) or not is_inside_tree(): return
	# Fixed ring: steal the oldest voice when saturated instead of allocating nodes.
	var voice: AudioStreamPlayer = voices[cursor]
	cursor = (cursor+1)%VOICE_LIMIT
	voice.stop()
	voice.stream = bank[id]
	voice.play()
	playedEvents += 1

func consume(events: Array) -> void:
	for event in events:
		match event.type:
			"swing": play_event("heavy" if event.get("heavy",false) else "swing")
			"hit": play_event("heavy" if event.window.sfx == "heavy" else "hit")
			"dragonHit", "enemyStrike": play_event("hit" if event.type == "dragonHit" else "swing")
			"parry", "guardBlock": play_event("parry")
			"hurt": play_event("hurt")
			"jump", "land", "dodge", "victory", "defeat": play_event(event.type)
			"kill": play_event("kill")
			"musouStart":
				play_event("musou")
				music.volume_db = -24
			"musouReady", "milestone": play_event("ready")

func update(musou_active: bool) -> void:
	if not muted: music.volume_db = -24 if musou_active else -16
