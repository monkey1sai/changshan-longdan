import { Vector3 } from 'three'
import { nextMove, type ChargeButton } from '../combat/combo.ts'
import { MOVES, type HitFx, type HitWindow, type MoveDef, type MoveId } from '../combat/moves.ts'
import { nextStamp } from '../combat/stamp.ts'
import { damp, dampAngle, sampleKeys, smoothstep } from '../core/math.ts'
import type { Arena } from './arena.ts'

export type PlayerState = 'move' | 'jump' | 'attack' | 'musou' | 'dodge' | 'hurt' | 'down' | 'dead'

export interface ActiveHit {
  window: HitWindow
  stamp: number
  x: number
  y: number
  z: number
  facing: number
}

export type PlayerEvent =
  | { type: 'moveStart'; moveId: MoveId }
  | { type: 'swing'; heavy: boolean }
  | { type: 'fx'; fx: HitFx; x: number; z: number; radius: number }
  | { type: 'jump' }
  | { type: 'land'; heavy: boolean }
  | { type: 'dodge' }
  | { type: 'musouStart' }
  | { type: 'hurt'; heavy: boolean }
  | { type: 'death' }

export interface PlayerControls {
  moveX: number // 世界座標的移動方向，長度 0..1
  moveZ: number
  attack: boolean // 以下為本幀按下
  charge: boolean
  jump: boolean
  dodge: boolean
  musou: boolean
}

export type AimFn = (x: number, z: number, maxDist: number) => { x: number; z: number } | null

export const MUSOU_MAX = 100
const RUN_SPEED = 7.4
const GRAVITY = 30
const JUMP_SPEED = 10.5
const DODGE_SPEED = 15
const DODGE_TIME = 0.42
const BUFFER = 0.45 // 預輸入緩衝：需涵蓋最長的可接招時間（N5 為 0.36 秒）
const IDLE: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }

export class Player {
  readonly pos = new Vector3()
  readonly vel = new Vector3()
  facing = Math.PI
  state: PlayerState = 'move'
  stateTime = 0
  move: MoveDef | null = null
  moveTime = 0
  normalCount = 0
  hp = 1000
  readonly maxHp = 1000
  musou = 0
  invuln = 0
  speed = 0
  runPhase = 0
  dodgeBack = false
  readonly events: PlayerEvent[] = []
  readonly activeHits: ActiveHit[] = []
  private buffered: ChargeButton | null = null
  private bufferAge = 0
  private jumpBuffer = 0
  private dodgeBuffer = 0
  private musouBuffer = 0
  private stamps: number[] = []
  private moveStartY = 0
  private readonly dodgeDir = new Vector3()

  reset(x: number, z: number, facing: number): void {
    this.pos.set(x, 0, z)
    this.vel.set(0, 0, 0)
    this.facing = facing
    this.state = 'move'
    this.stateTime = 0
    this.move = null
    this.moveTime = 0
    this.normalCount = 0
    this.hp = this.maxHp
    this.musou = 0
    this.invuln = 0
    this.speed = 0
    this.buffered = null
    this.jumpBuffer = 0
    this.dodgeBuffer = 0
    this.musouBuffer = 0
    this.events.length = 0
    this.activeHits.length = 0
  }

  get musouReady(): boolean {
    return this.musou >= MUSOU_MAX
  }

  /** 記錄按鍵；命中停頓（hit-stop）期間也要呼叫，避免吃鍵。 */
  queue(c: PlayerControls): void {
    if (c.attack) this.bufferButton('attack')
    if (c.charge) this.bufferButton('charge')
    if (c.jump) this.jumpBuffer = BUFFER
    if (c.dodge) this.dodgeBuffer = BUFFER
    if (c.musou) this.musouBuffer = BUFFER
  }

  update(dt: number, c: PlayerControls, aim: AimFn, arena: Arena): void {
    this.events.length = 0
    this.activeHits.length = 0
    this.bufferAge += dt
    if (this.bufferAge > BUFFER) this.buffered = null
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt)
    this.dodgeBuffer = Math.max(0, this.dodgeBuffer - dt)
    this.musouBuffer = Math.max(0, this.musouBuffer - dt)
    this.queue(c)
    this.invuln = Math.max(0, this.invuln - dt)
    this.stateTime += dt

    if (this.musouBuffer > 0 && this.musouReady && this.canMusou()) this.startMusou()
    else if (this.dodgeBuffer > 0 && this.canDodge()) this.startDodge(c)

    switch (this.state) {
      case 'move':
        this.updateMove(dt, c, aim)
        break
      case 'jump':
        this.updateJump(dt, c, aim)
        break
      case 'attack':
      case 'musou':
        this.updateAttack(dt, c, aim)
        break
      case 'dodge':
        this.updateDodge(dt)
        break
      case 'hurt':
        this.updateStagger(dt, 0.4)
        break
      case 'down':
        this.updateStagger(dt, 1.3)
        break
      case 'dead':
        this.updateStagger(dt, Infinity)
        break
    }
    arena.constrain(this.pos, 0.45)
  }

  /** 受到攻擊；回傳是否真的受傷（無敵、閃避、無雙中不受傷）。 */
  takeHit(damage: number, heavy: boolean, fromX: number, fromZ: number): boolean {
    if (this.state === 'dead' || this.state === 'musou' || this.invuln > 0) return false
    const armored = this.state === 'attack' && this.move?.armor === true
    this.hp = Math.max(0, this.hp - (armored ? damage * 0.5 : damage))
    this.gainMusou(4)
    if (this.hp <= 0) {
      this.state = 'dead'
      this.stateTime = 0
      this.move = null
      this.events.push({ type: 'death' })
      return true
    }
    if (armored) {
      this.events.push({ type: 'hurt', heavy: false })
      return true
    }
    const dx = this.pos.x - fromX
    const dz = this.pos.z - fromZ
    const d = Math.hypot(dx, dz) || 1
    this.facing = Math.atan2(-dx, -dz)
    this.move = null
    this.normalCount = 0
    this.state = heavy ? 'down' : 'hurt'
    this.stateTime = 0
    this.vel.set((dx / d) * (heavy ? 6 : 3), 0, (dz / d) * (heavy ? 6 : 3))
    if (heavy) this.invuln = 1.6
    this.events.push({ type: 'hurt', heavy })
    return true
  }

  gainMusou(amount: number): void {
    if (this.state === 'musou') return
    this.musou = Math.min(MUSOU_MAX, this.musou + amount)
  }

  private bufferButton(button: ChargeButton): void {
    this.buffered = button
    this.bufferAge = 0
  }

  private canMusou(): boolean {
    return (this.state === 'move' || this.state === 'attack' || this.state === 'hurt') && this.pos.y < 0.05
  }

  private canDodge(): boolean {
    if (this.state === 'move') return this.pos.y < 0.05
    const m = this.move
    return this.state === 'attack' && m !== null && m.airborne !== true && this.moveTime >= m.cancel * 0.75 && this.pos.y < 0.05
  }

  private startMusou(): void {
    this.musou = 0
    this.musouBuffer = 0
    this.startMove('MUSOU', IDLE, () => null)
    this.invuln = MOVES.MUSOU.duration + 0.4
    this.events.push({ type: 'musouStart' })
  }

  private startDodge(c: PlayerControls): void {
    const len = Math.hypot(c.moveX, c.moveZ)
    this.dodgeBack = len <= 0.1
    if (this.dodgeBack) {
      this.dodgeDir.set(-Math.sin(this.facing), 0, -Math.cos(this.facing))
    } else {
      this.dodgeDir.set(c.moveX / len, 0, c.moveZ / len)
      this.facing = Math.atan2(this.dodgeDir.x, this.dodgeDir.z)
    }
    this.state = 'dodge'
    this.stateTime = 0
    this.move = null
    this.normalCount = 0
    this.dodgeBuffer = 0
    this.buffered = null
    this.invuln = Math.max(this.invuln, 0.34)
    this.events.push({ type: 'dodge' })
  }

  private startJump(c: PlayerControls): void {
    this.jumpBuffer = 0
    this.state = 'jump'
    this.stateTime = 0
    this.move = null
    this.normalCount = 0
    this.vel.set(c.moveX * RUN_SPEED * 0.9, JUMP_SPEED, c.moveZ * RUN_SPEED * 0.9)
    this.pos.y = Math.max(this.pos.y, 0.01)
    this.events.push({ type: 'jump' })
  }

  private startMove(id: MoveId, c: PlayerControls, aim: AimFn): void {
    const m = MOVES[id]
    this.move = m
    this.moveTime = 0
    this.state = id === 'MUSOU' ? 'musou' : 'attack'
    this.stateTime = 0
    this.stamps = m.hits.map(() => nextStamp())
    this.normalCount = id.startsWith('N') ? Number(id.slice(1)) : 0
    this.buffered = null
    this.moveStartY = this.pos.y
    this.vel.set(0, 0, 0)
    const len = Math.hypot(c.moveX, c.moveZ)
    if (len > 0.2) {
      this.facing = Math.atan2(c.moveX, c.moveZ)
    } else {
      const target = aim(this.pos.x, this.pos.z, 6.5)
      if (target !== null) this.facing = Math.atan2(target.x - this.pos.x, target.z - this.pos.z)
    }
    this.events.push({ type: 'moveStart', moveId: id })
  }

  private toMove(): void {
    this.state = 'move'
    this.stateTime = 0
    this.move = null
  }

  private updateMove(dt: number, c: PlayerControls, aim: AimFn): void {
    this.vel.x = damp(this.vel.x, c.moveX * RUN_SPEED, 12, dt)
    this.vel.z = damp(this.vel.z, c.moveZ * RUN_SPEED, 12, dt)
    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    this.speed = Math.hypot(this.vel.x, this.vel.z)
    if (c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01) {
      this.facing = dampAngle(this.facing, Math.atan2(c.moveX, c.moveZ), 14, dt)
    }
    this.runPhase += this.speed * dt * 1.25
    if (this.jumpBuffer > 0) {
      this.startJump(c)
      return
    }
    if (this.buffered !== null) {
      const next = nextMove({ current: null, normalCount: 0, airborne: false, canChain: true }, this.buffered)
      if (next !== null) this.startMove(next, c, aim)
    }
  }

  private updateJump(dt: number, c: PlayerControls, aim: AimFn): void {
    this.vel.x = damp(this.vel.x, c.moveX * RUN_SPEED * 0.85, 4, dt)
    this.vel.z = damp(this.vel.z, c.moveZ * RUN_SPEED * 0.85, 4, dt)
    this.vel.y -= GRAVITY * dt
    this.pos.addScaledVector(this.vel, dt)
    this.speed = Math.hypot(this.vel.x, this.vel.z)
    if (c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01) {
      this.facing = dampAngle(this.facing, Math.atan2(c.moveX, c.moveZ), 6, dt)
    }
    if (this.buffered !== null && this.pos.y > 0.4) {
      const next = nextMove({ current: null, normalCount: 0, airborne: true, canChain: true }, this.buffered)
      if (next !== null) {
        this.startMove(next, c, aim)
        return
      }
    }
    if (this.pos.y <= 0) {
      this.pos.y = 0
      this.vel.set(0, 0, 0)
      this.events.push({ type: 'land', heavy: false })
      this.toMove()
    }
  }

  private updateAttack(dt: number, c: PlayerControls, aim: AimFn): void {
    const m = this.move
    if (m === null) {
      this.toMove()
      return
    }
    const prev = this.moveTime
    const t = (this.moveTime += dt)
    const hasInput = c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01
    if (this.state === 'musou') {
      // 無雙中可緩慢移動，方便把龍帶進敵陣
      this.pos.x += c.moveX * 3.2 * dt
      this.pos.z += c.moveZ * 3.2 * dt
      if (hasInput) this.facing = dampAngle(this.facing, Math.atan2(c.moveX, c.moveZ), 4, dt)
    } else if (t < 0.1 && hasInput) {
      this.facing = dampAngle(this.facing, Math.atan2(c.moveX, c.moveZ), 18, dt)
    }

    const fx = Math.sin(this.facing)
    const fz = Math.cos(this.facing)
    for (const l of m.lunge) {
      const step = (smoothstep(l.t0, l.t1, t) - smoothstep(l.t0, l.t1, prev)) * l.distance
      if (step > 0) {
        this.pos.x += fx * step
        this.pos.z += fz * step
      }
    }

    if (m.height !== undefined) {
      const k = sampleKeys(m.height.keys, t)
      const wasAir = this.pos.y > 0.05
      this.pos.y = Math.max(0, m.height.relative === true ? this.moveStartY * k : k)
      if (wasAir && this.pos.y <= 0.05) this.events.push({ type: 'land', heavy: true })
    }

    const heavySwing = m.id.startsWith('C') || m.id === 'N6' || m.id === 'MUSOU'
    for (const s of m.swings) if (prev < s && t >= s) this.events.push({ type: 'swing', heavy: heavySwing })

    for (let i = 0; i < m.hits.length; i++) {
      const w = m.hits[i]
      if (t < w.t0 || prev > w.t1) continue
      if (w.fx !== undefined && prev < w.t0) {
        const radius = w.shape.range
        this.events.push({ type: 'fx', fx: w.fx, x: this.pos.x, z: this.pos.z, radius })
      }
      this.activeHits.push({ window: w, stamp: this.stamps[i], x: this.pos.x, y: this.pos.y, z: this.pos.z, facing: this.facing })
    }

    if (this.state === 'attack' && t >= m.cancel) {
      if (this.buffered !== null) {
        const ctx = { current: m.id, normalCount: this.normalCount, airborne: this.pos.y > 0.3, canChain: true }
        const next = nextMove(ctx, this.buffered)
        if (next !== null) {
          this.startMove(next, c, aim)
          return
        }
      }
      if (this.jumpBuffer > 0 && m.airborne !== true && this.pos.y <= 0.01) {
        this.startJump(c)
        return
      }
    }

    if (t >= m.duration) {
      this.move = null
      this.normalCount = 0
      if (this.pos.y > 0.02) {
        this.state = 'jump'
        this.stateTime = 0
        this.vel.set(0, 0, 0)
      } else {
        this.toMove()
      }
    }
  }

  private updateDodge(dt: number): void {
    const v = DODGE_SPEED * (1 - smoothstep(0.08, DODGE_TIME, this.stateTime))
    this.pos.x += this.dodgeDir.x * v * dt
    this.pos.z += this.dodgeDir.z * v * dt
    this.speed = v
    if (this.stateTime >= DODGE_TIME) this.toMove()
  }

  private updateStagger(dt: number, duration: number): void {
    this.vel.x = damp(this.vel.x, 0, 5, dt)
    this.vel.z = damp(this.vel.z, 0, 5, dt)
    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    if (this.pos.y > 0) {
      this.vel.y -= GRAVITY * dt
      this.pos.y = Math.max(0, this.pos.y + this.vel.y * dt)
    }
    this.speed = 0
    if (this.stateTime >= duration) {
      if (this.state === 'down') this.invuln = Math.max(this.invuln, 0.8)
      this.toMove()
    }
  }
}
