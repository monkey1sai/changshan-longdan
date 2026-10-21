extends RefCounted

var limit: float
var obstacles: Array

func _init(value: float, rectangles: Array) -> void:
	limit = value
	obstacles = rectangles

func constrain(p: Vector3, radius: float) -> Vector3:
	var edge: float = limit - radius
	p.x = clampf(p.x, -edge, edge)
	p.z = clampf(p.z, -edge, edge)
	for o in obstacles:
		var cx: float = clampf(p.x, o.minX, o.maxX)
		var cz: float = clampf(p.z, o.minZ, o.maxZ)
		var dx: float = p.x - cx
		var dz: float = p.z - cz
		var d2: float = dx * dx + dz * dz
		if d2 >= radius * radius:
			continue
		if d2 > 1e-8:
			var distance: float = sqrt(d2)
			var push: float = (radius - distance) / distance
			p.x += dx * push
			p.z += dz * push
		else:
			var left: float = p.x - o.minX
			var right: float = o.maxX - p.x
			var near_edge: float = p.z - o.minZ
			var far_edge: float = o.maxZ - p.z
			var smallest: float = minf(minf(left, right), minf(near_edge, far_edge))
			if smallest == left:
				p.x = o.minX - radius
			elif smallest == right:
				p.x = o.maxX + radius
			elif smallest == near_edge:
				p.z = o.minZ - radius
			else:
				p.z = o.maxZ + radius
	return p
