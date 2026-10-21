extends RefCounted

const MASK32: int = 0xffffffff
static var _stamp: int = 0

static func damp(current: float, target: float, rate: float, dt: float) -> float:
	return current + (target - current) * (1.0 - exp(-rate * dt))

static func wrapAngle(angle: float) -> float:
	return fposmod(angle + PI, TAU) - PI

static func dampAngle(current: float, target: float, rate: float, dt: float) -> float:
	return current + wrapAngle(target - current) * (1.0 - exp(-rate * dt))

static func smoothstep(a: float, b: float, x: float) -> float:
	var t: float = clampf((x - a) / (b - a), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)

static func sampleKeys(keys: Array, t: float) -> float:
	if t <= keys[0][0]:
		return keys[0][1]
	for i in range(1, keys.size()):
		if t <= keys[i][0]:
			var t0: float = keys[i - 1][0]
			var t1: float = keys[i][0]
			var u: float = (t - t0) / (t1 - t0) if t1 > t0 else 1.0
			return lerpf(keys[i - 1][1], keys[i][1], u * u * (3.0 - 2.0 * u))
	return keys[-1][1]

static func imul32(a: int, b: int) -> int:
	# Low32 multiplication without overflowing an intermediate signed int64.
	var low: int = (a & 65535) * (b & 65535)
	var cross: int = (((a >> 16) & 65535) * (b & 65535) + (a & 65535) * ((b >> 16) & 65535)) & 65535
	return (low + (cross << 16)) & MASK32

static func rng(seed: int) -> Callable:
	var cell: Dictionary = {"a": seed & MASK32}
	return func() -> float:
		cell.a = (int(cell.a) + 0x6d2b79f5) & MASK32
		var t: int = imul32(int(cell.a) ^ (int(cell.a) >> 15), int(cell.a) | 1)
		t = (t ^ (t + imul32(t ^ (t >> 7), t | 61))) & MASK32
		return float((t ^ (t >> 14)) & MASK32) / 4294967296.0

static func next_stamp() -> int:
	_stamp = (_stamp + 1) & MASK32
	if _stamp == 0:
		_stamp = 1
	return _stamp

static func inHitShape(shape: Dictionary, ax: float, az: float, facing: float, tx: float, tz: float, radius: float) -> bool:
	var fx: float = sin(facing)
	var fz: float = cos(facing)
	var offset: float = shape.get("offset", 0.0)
	var dx: float = tx - (ax + fx * offset)
	var dz: float = tz - (az + fz * offset)
	match shape.kind:
		"circle":
			return dx * dx + dz * dz <= pow(shape.range + radius, 2.0)
		"arc":
			var distance: float = sqrt(dx * dx + dz * dz)
			if distance > shape.range + radius:
				return false
			if distance <= radius:
				return true
			var angle: float = acos(clampf((dx * fx + dz * fz) / distance, -1.0, 1.0))
			return angle <= shape.halfAngle + asin(minf(1.0, radius / distance))
		"line":
			var along: float = dx * fx + dz * fz
			return along >= -radius and along <= shape.range + radius and absf(dx * fz - dz * fx) <= shape.width / 2.0 + radius
	return false

static func shapeReach(shape: Dictionary) -> float:
	var offset: float = absf(shape.get("offset", 0.0))
	if shape.kind == "line":
		return offset + sqrt(shape.range * shape.range + shape.width * shape.width / 4.0)
	return offset + shape.range
