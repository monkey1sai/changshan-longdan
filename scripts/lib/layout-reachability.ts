import type { Point2 } from '../../src/entities/arena.ts'
import type { Rect } from '../../src/world/layout.ts'

// E11 test instrumentation only. Runtime movement remains Arena.constrain. The clearance field includes the arena
// boundary and each actual collision rectangle. Half a cell diagonal reserves enough clearance for both four-way
// edges and the connector from a rounded cell to the exact start/goal (distance-to-obstacles is 1-Lipschitz).
export function clearanceAt(p: Point2, limit: number, obstacles: readonly Rect[]): number {
  let clearance = Math.min(limit - Math.abs(p.x), limit - Math.abs(p.z))
  for (const o of obstacles) {
    const dx = Math.max(o.minX - p.x, 0, p.x - o.maxX)
    const dz = Math.max(o.minZ - p.z, 0, p.z - o.maxZ)
    clearance = Math.min(clearance, Math.hypot(dx, dz))
  }
  return clearance
}

export class ReachabilityGrid {
  readonly limit: number
  readonly obstacles: readonly Rect[]
  readonly step: number
  readonly size: number
  readonly reserve: number
  readonly clearance: Float64Array

  constructor(limit: number, obstacles: readonly Rect[], step = 0.25) {
    if (!(limit > 0 && step > 0) || !Number.isInteger(2 * limit / step)) throw new Error('Invalid reachability grid')
    this.limit = limit
    this.obstacles = obstacles
    this.step = step
    this.size = 2 * limit / step + 1
    this.reserve = step / Math.sqrt(2)
    this.clearance = new Float64Array(this.size * this.size)
    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        this.clearance[z * this.size + x] = clearanceAt({ x: -limit + x * step, z: -limit + z * step }, limit, obstacles)
      }
    }
  }

  index(p: Point2): number {
    if (Math.abs(p.x) > this.limit || Math.abs(p.z) > this.limit) return -1
    return Math.round((p.z + this.limit) / this.step) * this.size + Math.round((p.x + this.limit) / this.step)
  }

  reaches(start: Point2, goals: readonly Point2[], radius: number): boolean[] {
    if (!(radius >= 0 && Number.isFinite(radius))) throw new Error('Invalid body radius')
    const threshold = radius + this.reserve
    const first = this.index(start)
    const visited = new Uint8Array(this.clearance.length)
    const queue = new Int32Array(this.clearance.length)
    let head = 0, tail = 0
    if (first >= 0 && this.clearance[first]! >= threshold) {
      visited[first] = 1
      queue[tail++] = first
    }
    const visit = (at: number) => {
      if (at < 0 || at >= visited.length || visited[at] || this.clearance[at]! < threshold) return
      visited[at] = 1
      queue[tail++] = at
    }
    while (head < tail) {
      const at = queue[head++]!, x = at % this.size
      if (x > 0) visit(at - 1)
      if (x < this.size - 1) visit(at + 1)
      visit(at - this.size)
      visit(at + this.size)
    }
    return goals.map((p) => { const at = this.index(p); return at >= 0 && visited[at] === 1 })
  }

  // A conservative lower bound for a common traversable diameter: each necessary goal has some qualifying path.
  // It measures necessary routes, not the minimum width of every unrelated gap in the level.
  commonPathWidth(start: Point2, goals: readonly Point2[], minimumRadius: number, ceilingRadius = 4): number {
    if (!this.reaches(start, goals, minimumRadius).every(Boolean)) return 0
    let low = minimumRadius, high = ceilingRadius
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2
      if (this.reaches(start, goals, mid).every(Boolean)) low = mid
      else high = mid
    }
    return 2 * low
  }
}
