extends RefCounted

var cellSize: float
var cells: Dictionary = {}

func _init(size: float) -> void:
	cellSize = size

func clear() -> void:
	cells.clear()

func cellKey(cx: int, cz: int) -> int:
	return (cx + 32768) * 65536 + cz + 32768

func insert(id: int, x: float, z: float) -> void:
	var key: int = cellKey(int(floor(x / cellSize)), int(floor(z / cellSize)))
	if not cells.has(key):
		cells[key] = []
	cells[key].append(id)

func query(x: float, z: float, radius: float) -> Array:
	var out: Array = []
	for cx in range(int(floor((x - radius) / cellSize)), int(floor((x + radius) / cellSize)) + 1):
		for cz in range(int(floor((z - radius) / cellSize)), int(floor((z + radius) / cellSize)) + 1):
			var key: int = cellKey(cx, cz)
			if cells.has(key):
				out.append_array(cells[key])
	return out
