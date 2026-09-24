export const TAU = Math.PI * 2

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 與幀率無關的指數趨近；lambda 越大收斂越快。 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

/** 把角度換算到 [-π, π)。 */
export function wrapAngle(angle: number): number {
  let a = (angle + Math.PI) % TAU
  if (a < 0) a += TAU
  return a - Math.PI
}

/** 沿最短方向趨近目標角度。 */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt))
}

export function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

/** 依 [時間, 值] 關鍵點取樣，段與段之間以 smoothstep 平滑。 */
export function sampleKeys(keys: readonly (readonly [number, number])[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 1
      return lerp(v0, v1, u * u * (3 - 2 * u))
    }
  }
  return keys[keys.length - 1][1]
}

/** mulberry32：可重現的亂數產生器，回傳 [0, 1)。 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function range(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng()
}
