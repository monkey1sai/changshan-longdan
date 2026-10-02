import { inHitShape, shapeReach } from '../combat/hitshape.ts'
import type { HitWindow } from '../combat/moves.ts'
import { createRng, damp, dampAngle, range, TAU, wrapAngle } from '../core/math.ts'
import { SpatialHash } from '../core/spatial-hash.ts'
import type { Arena } from './arena.ts'
import { DIFFICULTIES, type DifficultyProfile } from '../core/difficulty.ts'

export const Kind = { Spear: 0, Sword: 1, Captain: 2 } as const
export type Kind = (typeof Kind)[keyof typeof Kind]

export const State = {
  Formation: 0, // 列隊待命
  March: 1, // 行軍靠近
  Engage: 2, // 圍攻中
  Windup: 3, // 舉械蓄勢
  Strike: 4, // 出手
  Recover: 5, // 收招
  Flinch: 6, // 受擊硬直
  Air: 7, // 被打飛
  Knockback: 8, // 地面擊退
  Down: 9, // 倒地
  Getup: 10, // 起身
  Dead: 11,
} as const
export type State = (typeof State)[keyof typeof State]

export interface Spawn {
  x: number
  z: number
  yaw: number
  kind: Kind
}

export interface KillInfo {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  yaw: number
  spin: number
  kind: Kind
}

export interface HitInfo {
  id: number
  x: number
  y: number
  z: number
  dirX: number
  dirZ: number
  killed: boolean
}

export interface Strike {
  damage: number
  heavy: boolean
  x: number
  z: number
}

export const GRAVITY = 25
export const BODY_RADIUS = 0.42
const RELEASE_RANGE = 42
const MAX_ENGAGED = 54
const MIN_ENGAGED = 20
const RING_SIZE = 9

/** 以 SoA typed array 保存全部魏兵，負責 AI、物理與受擊反應。 */
export class EnemyStore {
  readonly capacity: number
  count = 0
  aliveCount = 0
  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly vz: Float32Array
  readonly yaw: Float32Array
  readonly hp: Float32Array
  readonly maxHp: Float32Array
  readonly stateTime: Float32Array
  readonly flash: Float32Array
  readonly phase: Float32Array
  readonly moveBlend: Float32Array
  readonly spin: Float32Array
  readonly spinVel: Float32Array
  readonly cooldown: Float32Array
  readonly ring: Float32Array
  readonly side: Float32Array
  readonly scale: Float32Array
  readonly state: Uint8Array
  readonly kind: Uint8Array
  readonly alive: Uint8Array
  readonly engaged: Uint8Array
  readonly token: Uint8Array
  readonly hitStamp: Uint32Array
  readonly kills: KillInfo[] = []
  readonly strikes: Strike[] = []
  private readonly hash = new SpatialHash(2)
  private readonly candidates: number[] = []
  private readonly neighbors: number[] = []
  private readonly order: number[] = []
  private readonly dist2: Float32Array
  private engageTimer = 0
  private tokenTimer = 0
  private attackers = 0
  private difficulty: DifficultyProfile = DIFFICULTIES.normal
  private engageRange = DIFFICULTIES.normal.engageRange
  private maxAttackers = DIFFICULTIES.normal.maxAttackers
  private readonly rng: () => number

  constructor(capacity: number, seed = 7) {
    this.capacity = capacity
    const f = () => new Float32Array(capacity)
    const u = () => new Uint8Array(capacity)
    this.x = f()
    this.y = f()
    this.z = f()
    this.vx = f()
    this.vy = f()
    this.vz = f()
    this.yaw = f()
    this.hp = f()
    this.maxHp = f()
    this.stateTime = f()
    this.flash = f()
    this.phase = f()
    this.moveBlend = f()
    this.spin = f()
    this.spinVel = f()
    this.cooldown = f()
    this.ring = f()
    this.side = f()
    this.scale = f()
    this.dist2 = f()
    this.state = u()
    this.kind = u()
    this.alive = u()
    this.engaged = u()
    this.token = u()
    this.hitStamp = new Uint32Array(capacity)
    this.rng = createRng(seed)
  }

  get attackerCount(): number {
    return this.attackers
  }

  setPressure(difficulty: DifficultyProfile, engageRange = difficulty.engageRange, maxAttackers = difficulty.maxAttackers): void {
    this.difficulty = difficulty
    this.engageRange = engageRange
    this.maxAttackers = maxAttackers
  }

  reset(spawns: readonly Spawn[]): void {
    if (spawns.length > this.capacity) throw new Error(`士兵數 ${spawns.length} 超過容量 ${this.capacity}`)
    this.count = spawns.length
    this.aliveCount = spawns.length
    this.attackers = 0
    this.engageTimer = 0
    this.tokenTimer = 0
    this.kills.length = 0
    this.strikes.length = 0
    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[i]
      const captain = s.kind === Kind.Captain
      this.x[i] = s.x
      this.y[i] = 0
      this.z[i] = s.z
      this.vx[i] = 0
      this.vy[i] = 0
      this.vz[i] = 0
      this.yaw[i] = s.yaw
      this.kind[i] = s.kind
      this.hp[i] = captain ? 230 * this.difficulty.captainHp : range(this.rng, 40, 52)
      this.maxHp[i] = this.hp[i]
      this.state[i] = State.Formation
      this.stateTime[i] = this.rng() * 2
      this.flash[i] = 0
      this.phase[i] = this.rng() * TAU
      this.moveBlend[i] = 0
      this.spin[i] = 0
      this.spinVel[i] = 0
      this.cooldown[i] = range(this.rng, 0.5, 3)
      this.ring[i] = 3
      this.side[i] = this.rng() < 0.5 ? -1 : 1
      this.scale[i] = captain ? 1.22 : range(this.rng, 0.96, 1.04)
      this.alive[i] = 1
      this.engaged[i] = 0
      this.token[i] = 0
      this.hitStamp[i] = 0
    }
    this.rebuildHash()
  }

  update(dt: number, px: number, py: number, pz: number, arena: Arena): void {
    this.strikes.length = 0
    this.engageTimer -= dt
    if (this.engageTimer <= 0) {
      this.engageTimer = 0.2
      this.assignEngagement(px, pz)
    }
    this.assignTokens(dt, px, pz)
    for (let i = 0; i < this.count; i++) {
      if (this.alive[i] === 0) continue
      this.flash[i] = Math.max(0, this.flash[i] - dt * 9)
      this.cooldown[i] -= dt
      this.stateTime[i] += dt
      this.step(i, dt, px, py, pz)
      const speed = Math.hypot(this.vx[i], this.vz[i])
      this.moveBlend[i] = damp(this.moveBlend[i], Math.min(1, speed / 3.5), 10, dt)
      this.phase[i] += speed * dt * 2.3
    }
    this.rebuildHash()
    this.separate(px, pz, arena)
  }

  /**
   * 以攻擊判定窗打擊範圍內的士兵；同一 stamp 對同一人只算一次。
   * 命中結果寫入 out，擊破的士兵另外記在 kills。
   */
  applyHit(stamp: number, win: HitWindow, ax: number, ay: number, az: number, facing: number, out: HitInfo[]): void {
    const ids = this.hash.query(ax, az, shapeReach(win.shape) + BODY_RADIUS * 1.5 + 0.5, this.candidates)
    const fx = Math.sin(facing)
    const fz = Math.cos(facing)
    const offset = win.shape.offset ?? 0
    const cx = ax + fx * offset
    const cz = az + fz * offset
    const yMin = ay + (win.yMin ?? -0.6)
    const yMax = ay + (win.yMax ?? 2.6)
    for (const i of ids) {
      if (this.alive[i] === 0 || this.hitStamp[i] === stamp) continue
      if (this.y[i] < yMin || this.y[i] > yMax) continue
      if (!inHitShape(win.shape, ax, az, facing, this.x[i], this.z[i], BODY_RADIUS * this.scale[i])) continue
      this.hitStamp[i] = stamp
      let dirX = fx
      let dirZ = fz
      if (win.radial) {
        const dx = this.x[i] - cx
        const dz = this.z[i] - cz
        const d = Math.hypot(dx, dz)
        if (d > 1e-3) {
          dirX = dx / d
          dirZ = dz / d
        }
      }
      const killed = this.damage(i, win, dirX, dirZ)
      out.push({ id: i, x: this.x[i], y: this.y[i], z: this.z[i], dirX, dirZ, killed })
    }
  }

  /** 最近的存活士兵編號，範圍內沒有時回傳 -1。 */
  nearest(px: number, pz: number, maxDist: number): number {
    let best = -1
    let bestD = maxDist * maxDist
    for (const i of this.hash.query(px, pz, maxDist, this.neighbors)) {
      if (this.alive[i] === 0) continue
      const dx = this.x[i] - px
      const dz = this.z[i] - pz
      const d2 = dx * dx + dz * dz
      if (d2 < bestD) {
        bestD = d2
        best = i
      }
    }
    return best
  }

  private step(i: number, dt: number, px: number, py: number, pz: number): void {
    const t = this.stateTime[i]
    switch (this.state[i]) {
      case State.Formation: {
        this.brake(i, dt, 8)
        const dx = px - this.x[i]
        const dz = pz - this.z[i]
        if (dx * dx + dz * dz < 2000) this.yaw[i] = dampAngle(this.yaw[i], Math.atan2(dx, dz), 1.5, dt)
        if (this.engaged[i] === 1) this.setState(i, State.Engage)
        break
      }
      case State.March: {
        const dx = px - this.x[i]
        const dz = pz - this.z[i]
        const d = Math.hypot(dx, dz) || 1
        this.vx[i] = damp(this.vx[i], (dx / d) * 2.8, 4, dt)
        this.vz[i] = damp(this.vz[i], (dz / d) * 2.8, 4, dt)
        this.yaw[i] = dampAngle(this.yaw[i], Math.atan2(dx, dz), 6, dt)
        if (this.engaged[i] === 1) this.setState(i, State.Engage)
        break
      }
      case State.Engage:
        this.engage(i, dt, px, pz)
        break
      case State.Windup:
        this.brake(i, dt, 10)
        this.yaw[i] = dampAngle(this.yaw[i], Math.atan2(px - this.x[i], pz - this.z[i]), 8, dt)
        if (t >= (this.kind[i] === Kind.Captain ? 0.85 : 0.55) * this.difficulty.windup) this.strike(i, px, py, pz)
        break
      case State.Strike:
        this.brake(i, dt, 6)
        if (t >= 0.14) this.setState(i, State.Recover)
        break
      case State.Recover:
        this.brake(i, dt, 8)
        if (t >= 0.5) {
          this.releaseToken(i)
          this.cooldown[i] = range(this.rng, 2.5, 5.5)
          this.setState(i, State.Engage)
        }
        break
      case State.Flinch:
        this.brake(i, dt, 5)
        if (t >= 0.42) this.recover(i)
        break
      case State.Air:
        this.vy[i] -= GRAVITY * dt
        this.x[i] += this.vx[i] * dt
        this.y[i] += this.vy[i] * dt
        this.z[i] += this.vz[i] * dt
        this.spin[i] += this.spinVel[i] * dt
        if (this.y[i] <= 0 && this.vy[i] <= 0) {
          this.y[i] = 0
          this.vy[i] = 0
          this.vx[i] *= 0.35
          this.vz[i] *= 0.35
          this.setState(i, State.Down)
        }
        return // 空中已自行積分
      case State.Knockback:
        this.brake(i, dt, 5)
        if (t >= 0.4) this.recover(i)
        break
      case State.Down:
        this.brake(i, dt, 6)
        if (t >= 1.15) this.setState(i, State.Getup)
        break
      case State.Getup:
        this.brake(i, dt, 10)
        if (t >= 0.5) this.recover(i)
        break
    }
    this.x[i] += this.vx[i] * dt
    this.z[i] += this.vz[i] * dt
  }

  /** 圍攻：拿到攻擊令牌的逼近出手，其餘在各自的環上繞圈等待。 */
  private engage(i: number, dt: number, px: number, pz: number): void {
    const dx = this.x[i] - px
    const dz = this.z[i] - pz
    const d = Math.max(Math.hypot(dx, dz), 1e-3)
    const nx = dx / d
    const nz = dz / d
    const hasToken = this.token[i] === 1
    const err = d - (hasToken ? 1.55 : this.ring[i])
    const speed = Math.max(-2.5, Math.min(err * 2.2, err > 3 ? 5.2 : 3.2))
    let tx = -nx * speed
    let tz = -nz * speed
    if (!hasToken && Math.abs(err) < 1.5) {
      tx += -nz * this.side[i] * 0.9
      tz += nx * this.side[i] * 0.9
    }
    this.vx[i] = damp(this.vx[i], tx, 6, dt)
    this.vz[i] = damp(this.vz[i], tz, 6, dt)
    this.yaw[i] = dampAngle(this.yaw[i], Math.atan2(-dx, -dz), 9, dt)
    if (hasToken && d < 1.9) this.setState(i, State.Windup)
  }

  private strike(i: number, px: number, py: number, pz: number): void {
    this.setState(i, State.Strike)
    const captain = this.kind[i] === Kind.Captain
    this.vx[i] = Math.sin(this.yaw[i]) * 2.2
    this.vz[i] = Math.cos(this.yaw[i]) * 2.2
    const dx = px - this.x[i]
    const dz = pz - this.z[i]
    const inReach = Math.hypot(dx, dz) < (captain ? 2.9 : 2.4) && py < 1.4
    if (inReach && Math.abs(wrapAngle(Math.atan2(dx, dz) - this.yaw[i])) < 1.0) {
      this.strikes.push({ damage: (captain ? 70 : 26) * this.difficulty.enemyDamage, heavy: captain, x: this.x[i], z: this.z[i] })
    }
  }

  private damage(i: number, win: HitWindow, dirX: number, dirZ: number): boolean {
    const captain = this.kind[i] === Kind.Captain
    const push = win.push * (captain ? 0.6 : 1)
    const lift = captain ? 0.7 : 1
    this.hp[i] -= win.damage
    this.flash[i] = 1
    this.releaseToken(i)
    if (this.hp[i] <= 0) {
      this.alive[i] = 0
      this.state[i] = State.Dead
      this.aliveCount--
      this.kills.push({
        id: i,
        x: this.x[i],
        y: this.y[i],
        z: this.z[i],
        vx: dirX * push * 0.8 + this.vx[i] * 0.3,
        vy: Math.max(win.lift, 2.5) * 0.8,
        vz: dirZ * push * 0.8 + this.vz[i] * 0.3,
        yaw: this.yaw[i],
        spin: this.spin[i],
        kind: this.kind[i] as Kind,
      })
      return true
    }
    const airborne = this.state[i] === State.Air
    this.yaw[i] = Math.atan2(-dirX, -dirZ) // 面向攻擊來源，往後飛
    switch (win.reaction) {
      case 'flinch':
        if (airborne) {
          this.vy[i] = Math.max(this.vy[i], 3.2)
          this.vx[i] = dirX * push * 0.4
          this.vz[i] = dirZ * push * 0.4
        } else if (!(captain && this.state[i] === State.Windup && this.rng() < 0.5)) {
          this.setState(i, State.Flinch)
          this.vx[i] = dirX * push
          this.vz[i] = dirZ * push
        }
        break
      case 'launch':
        this.vy[i] = airborne ? Math.max(this.vy[i], win.lift * 0.75) : win.lift * lift
        this.vx[i] = dirX * push
        this.vz[i] = dirZ * push
        this.spinVel[i] = -range(this.rng, 3, 6)
        if (!airborne) this.enterAir(i)
        break
      case 'knockback':
        this.vx[i] = dirX * push
        this.vz[i] = dirZ * push
        if (airborne) this.vy[i] = Math.max(this.vy[i], 2.5)
        else this.setState(i, State.Knockback)
        break
      case 'blowaway':
        this.vy[i] = Math.max(win.lift, 3) * lift
        this.vx[i] = dirX * push
        this.vz[i] = dirZ * push
        this.spinVel[i] = -range(this.rng, 9, 14)
        if (!airborne) this.enterAir(i)
        break
      case 'knockdown':
        this.vx[i] = dirX * push * (airborne ? 0.5 : 1)
        this.vz[i] = dirZ * push * (airborne ? 0.5 : 1)
        if (airborne) this.vy[i] = -10
        else this.setState(i, State.Down)
        break
    }
    return false
  }

  private enterAir(i: number): void {
    this.setState(i, State.Air)
    this.spin[i] = 0
    this.y[i] = Math.max(this.y[i], 0.01)
  }

  private assignEngagement(px: number, pz: number): void {
    const order = this.order
    order.length = 0
    for (let i = 0; i < this.count; i++) {
      if (this.alive[i] === 0) continue
      const dx = this.x[i] - px
      const dz = this.z[i] - pz
      this.dist2[i] = dx * dx + dz * dz
      order.push(i)
    }
    order.sort((a, b) => this.dist2[a] - this.dist2[b])
    let engaged = 0
    for (const i of order) {
      const d = Math.sqrt(this.dist2[i])
      const keep = this.engaged[i] === 1 && d < RELEASE_RANGE
      if (engaged < MAX_ENGAGED && (d < this.engageRange || keep)) {
        this.engaged[i] = 1
        this.ring[i] = 2.7 + 1.25 * Math.floor(engaged / RING_SIZE)
        engaged++
      } else if (this.engaged[i] === 1) {
        this.engaged[i] = 0
        this.releaseToken(i)
        if (this.state[i] === State.Engage) this.setState(i, State.March)
      }
    }
    // 圍攻人數不足時，讓最近的待命士兵行軍過來
    let need = MIN_ENGAGED - engaged
    for (const i of order) {
      if (need <= 0) break
      if (this.engaged[i] === 1) continue
      if (this.state[i] === State.Formation) this.setState(i, State.March)
      if (this.state[i] === State.March) need--
    }
  }

  private assignTokens(dt: number, px: number, pz: number): void {
    this.tokenTimer -= dt
    if (this.tokenTimer > 0 || this.attackers >= this.maxAttackers) return
    let best = -1
    let bestD = 64
    for (let i = 0; i < this.count; i++) {
      if (this.alive[i] === 0 || this.engaged[i] === 0 || this.token[i] === 1) continue
      if (this.state[i] !== State.Engage || this.cooldown[i] > 0) continue
      const dx = this.x[i] - px
      const dz = this.z[i] - pz
      const d2 = dx * dx + dz * dz
      if (d2 < bestD) {
        bestD = d2
        best = i
      }
    }
    if (best >= 0) {
      this.token[best] = 1
      this.attackers++
      this.tokenTimer = range(this.rng, 0.2, 0.6)
    }
  }

  private separate(px: number, pz: number, arena: Arena): void {
    const point = { x: 0, z: 0 }
    for (let i = 0; i < this.count; i++) {
      if (this.alive[i] === 0) continue
      if (this.state[i] !== State.Air) {
        for (const j of this.hash.query(this.x[i], this.z[i], 1.1, this.neighbors)) {
          if (j <= i || this.alive[j] === 0 || this.state[j] === State.Air) continue
          const dx = this.x[j] - this.x[i]
          const dz = this.z[j] - this.z[i]
          const d2 = dx * dx + dz * dz
          const minD = (this.scale[i] + this.scale[j]) * BODY_RADIUS
          if (d2 >= minD * minD) continue
          if (d2 < 1e-6) {
            this.x[j] += 0.02 * this.side[j]
            continue
          }
          const d = Math.sqrt(d2)
          const push = ((minD - d) / d) * 0.5
          this.x[i] -= dx * push
          this.z[i] -= dz * push
          this.x[j] += dx * push
          this.z[j] += dz * push
        }
        const dx = this.x[i] - px
        const dz = this.z[i] - pz
        const d2 = dx * dx + dz * dz
        if (d2 < 0.9 && d2 > 1e-6) {
          const d = Math.sqrt(d2)
          this.x[i] = px + (dx / d) * 0.95
          this.z[i] = pz + (dz / d) * 0.95
        }
      }
      point.x = this.x[i]
      point.z = this.z[i]
      arena.constrain(point, BODY_RADIUS * this.scale[i])
      this.x[i] = point.x
      this.z[i] = point.z
    }
  }

  private rebuildHash(): void {
    this.hash.clear()
    for (let i = 0; i < this.count; i++) {
      if (this.alive[i] === 1) this.hash.insert(i, this.x[i], this.z[i])
    }
  }

  private setState(i: number, s: State): void {
    this.state[i] = s
    this.stateTime[i] = 0
  }

  private recover(i: number): void {
    this.setState(i, this.engaged[i] === 1 ? State.Engage : State.March)
  }

  private brake(i: number, dt: number, lambda: number): void {
    this.vx[i] = damp(this.vx[i], 0, lambda, dt)
    this.vz[i] = damp(this.vz[i], 0, lambda, dt)
  }

  private releaseToken(i: number): void {
    if (this.token[i] === 1) {
      this.token[i] = 0
      this.attackers = Math.max(0, this.attackers - 1)
    }
  }
}

/** 依小隊中心排出 4×3 的方陣，前排中央每三隊配一名隊長。 */
export function squadSpawns(centers: readonly { x: number; z: number }[], rng: () => number): Spawn[] {
  const spawns: Spawn[] = []
  centers.forEach((c, s) => {
    const sword = s % 2 === 1
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const captain = s % 3 === 0 && row === 2 && col === 1
        spawns.push({
          x: c.x + (col - 1.5) * 1.6 + (rng() - 0.5) * 0.4,
          z: c.z + (row - 1) * 1.7 + (rng() - 0.5) * 0.4,
          yaw: (rng() - 0.5) * 0.3,
          kind: captain ? Kind.Captain : sword ? Kind.Sword : Kind.Spear,
        })
      }
    }
  })
  return spawns
}
