import { Vector3, type Vector3Like } from 'three'
import { MOVES, type HitWindow } from '../combat/moves.ts'
import { nextStamp } from '../combat/stamp.ts'
import { easeOutCubic, smoothstep } from '../core/math.ts'

/** 蒼龍從召喚到消失的時間，與無雙招式等長。 */
export const DRAGON_DURATION = MOVES.MUSOU.duration
/** 盤旋階段的撞擊區間（秒）。 */
export const DRAGON_STRIKE_START = 0.35
export const DRAGON_STRIKE_END = 2.55
/** 每隔這麼久換一次命中編號：同一名敵兵每段最多被撞一次。 */
export const DRAGON_HIT_INTERVAL = 0.12

/** 龍頭撞擊：盤旋中每 0.12 秒一次，把附近敵兵撞上天。 */
export const DRAGON_HIT: HitWindow = {
  t0: 0, t1: 0, shape: { kind: 'circle', range: 2.8 }, damage: 16, reaction: 'launch',
  push: 7, lift: 7, hitstop: 0, shake: 0.05, radial: true, yMin: -8, yMax: 2, sfx: 'light',
}

const apex = new Vector3()
const impact = new Vector3()

/** 無雙召喚的蒼龍在規則上的部分：龍頭軌跡、撞擊區間與節奏。畫面由 fx/dragon.ts 依此繪製。 */
export class DragonStrike {
  readonly headPos = new Vector3()
  private t = 0
  private running = false
  private startFacing = 0
  private readonly center = new Vector3()
  private hitTimer = 0
  private currentStamp = 0

  get active(): boolean {
    return this.running
  }

  get elapsed(): number {
    return this.t
  }

  /** 盤旋階段龍頭會撞開附近的敵兵。 */
  get striking(): boolean {
    return this.running && this.t > DRAGON_STRIKE_START && this.t < DRAGON_STRIKE_END
  }

  /** 目前這一段撞擊的命中編號；只在 striking 時有意義。 */
  get stamp(): number {
    return this.currentStamp
  }

  start(center: Vector3Like, facing: number): void {
    this.running = true
    this.t = 0
    this.startFacing = facing
    this.center.copy(center)
    this.hitTimer = 0
  }

  stop(): void {
    this.running = false
  }

  update(dt: number, center: Vector3Like, facing: number): void {
    if (!this.running) return
    this.t += dt
    if (this.t >= DRAGON_DURATION) {
      this.stop()
      return
    }
    this.center.copy(center)
    this.headAt(this.t, facing, this.headPos)
    if (this.striking) {
      this.hitTimer -= dt
      if (this.hitTimer <= 0) {
        this.hitTimer = DRAGON_HIT_INTERVAL
        this.currentStamp = nextStamp()
      }
    }
  }

  private headAt(t: number, facing: number, out: Vector3): Vector3 {
    const c = this.center
    const spiral = (tt: number, o: Vector3) => {
      const ang = this.startFacing + Math.PI + tt * 4.6
      const grow = easeOutCubic(Math.min(1, tt / 0.5))
      const r = 1.2 + 4.6 * grow + Math.sin(tt * 3) * 0.6 * grow
      const y = 0.5 + 3.2 * grow + Math.sin(tt * 5.2) * 1.1 * grow
      return o.set(c.x + Math.sin(ang) * r, y, c.z + Math.cos(ang) * r)
    }
    if (t < DRAGON_STRIKE_END) return spiral(t, out)
    const fx = Math.sin(facing)
    const fz = Math.cos(facing)
    apex.set(c.x + fx * 3, 15, c.z + fz * 3)
    impact.set(c.x + fx * 6, 0, c.z + fz * 6)
    if (t < 2.95) return spiral(DRAGON_STRIKE_END, out).lerp(apex, smoothstep(0, 1, (t - DRAGON_STRIKE_END) / 0.4))
    if (t < 3.1) {
      const u = (t - 2.95) / 0.15
      return out.copy(apex).lerp(impact, u * u)
    }
    const u = (t - 3.1) / 0.5
    return out.set(impact.x + fx * 3 * u, -5 * u, impact.z + fz * 3 * u)
  }
}
