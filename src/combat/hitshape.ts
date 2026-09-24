import { clamp } from '../core/math.ts'

export type HitShape =
  | { kind: 'arc'; range: number; halfAngle: number; offset?: number }
  | { kind: 'circle'; range: number; offset?: number }
  | { kind: 'line'; range: number; width: number; offset?: number }

/**
 * 判斷半徑 radius 的目標是否落在攻擊範圍內（只算水平面）。
 * facing 是攻擊者朝向角，前方向量為 (sin, cos)；offset 會把判定中心沿前方平移。
 */
export function inHitShape(
  shape: HitShape,
  ax: number,
  az: number,
  facing: number,
  tx: number,
  tz: number,
  radius: number,
): boolean {
  const fx = Math.sin(facing)
  const fz = Math.cos(facing)
  const offset = shape.offset ?? 0
  const dx = tx - (ax + fx * offset)
  const dz = tz - (az + fz * offset)
  switch (shape.kind) {
    case 'circle':
      return dx * dx + dz * dz <= (shape.range + radius) ** 2
    case 'arc': {
      const dist = Math.hypot(dx, dz)
      if (dist > shape.range + radius) return false
      if (dist <= radius) return true
      const angle = Math.acos(clamp((dx * fx + dz * fz) / dist, -1, 1))
      return angle <= shape.halfAngle + Math.asin(Math.min(1, radius / dist))
    }
    case 'line': {
      const along = dx * fx + dz * fz
      if (along < -radius || along > shape.range + radius) return false
      return Math.abs(dx * fz - dz * fx) <= shape.width / 2 + radius
    }
  }
}

/** 形狀從攻擊者算起可能碰到的最遠距離，用來向空間格網查詢候選目標。 */
export function shapeReach(shape: HitShape): number {
  const offset = Math.abs(shape.offset ?? 0)
  if (shape.kind === 'line') return offset + Math.hypot(shape.range, shape.width / 2)
  return offset + shape.range
}
