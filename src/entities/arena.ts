import { clamp } from '../core/math.ts'
import type { Rect } from '../world/layout.ts'

export interface Point2 {
  x: number
  z: number
}

/** 戰場邊界與障礙物（皆為水平面上的矩形），以圓形角色做推出碰撞。 */
export class Arena {
  readonly limit: number
  readonly obstacles: readonly Rect[]

  constructor(limit: number, obstacles: readonly Rect[]) {
    this.limit = limit
    this.obstacles = obstacles
  }

  constrain(p: Point2, radius: number): void {
    const lim = this.limit - radius
    p.x = clamp(p.x, -lim, lim)
    p.z = clamp(p.z, -lim, lim)
    for (const o of this.obstacles) {
      const cx = clamp(p.x, o.minX, o.maxX)
      const cz = clamp(p.z, o.minZ, o.maxZ)
      const dx = p.x - cx
      const dz = p.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= radius * radius) continue
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2)
        const push = (radius - d) / d
        p.x += dx * push
        p.z += dz * push
      } else {
        // 圓心已在矩形內：沿穿透最淺的方向推出
        const left = p.x - o.minX
        const right = o.maxX - p.x
        const near = p.z - o.minZ
        const far = o.maxZ - p.z
        const m = Math.min(left, right, near, far)
        if (m === left) p.x = o.minX - radius
        else if (m === right) p.x = o.maxX + radius
        else if (m === near) p.z = o.minZ - radius
        else p.z = o.maxZ + radius
      }
    }
  }
}
