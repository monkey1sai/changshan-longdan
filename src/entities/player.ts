import { Vector3 } from 'three'
import { nextMove, type ChargeButton } from '../combat/combo.ts'
import { MOVES, type HitFx, type HitWindow, type MoveDef, type MoveId } from '../combat/moves.ts'
import { nextStamp } from '../combat/stamp.ts'
import { damp, dampAngle, sampleKeys, smoothstep } from '../core/math.ts'
import type { Arena } from './arena.ts'

export type PlayerState = 'move' | 'jump' | 'attack' | 'musou' | 'dodge' | 'guard' | 'hurt' | 'down' | 'dead'

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
  | { type: 'guardBlock'; damage: number; heavy: boolean }
  | { type: 'parry' }
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
  /** 按住防禦；可省略，省略時等同 false，維持既有呼叫端相容。 */
  guard?: boolean
}

export type AimFn = (x: number, z: number, maxDist: number) => { x: number; z: number } | null

export const MUSOU_MAX = 100
const RUN_SPEED = 7.4
const GRAVITY = 30
const JUMP_SPEED = 10.5
const DODGE_SPEED = 15
const DODGE_TIME = 0.42
const DASH_CANCEL_TIME = 0.1
const GUARD_ARC_COS = Math.cos(Math.PI * 0.36) // 前方約 65 度半角
const PARRY_TIME = 0.16
const COUNTER_TIME = 0.72
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
  /** 本次連續防禦已維持多久，供 HUD 與姿勢使用。 */
  guardTimer = 0
  /** 剛起防時的完美格擋窗口；歸零後只保留一般格擋。 */
  parryTimer = 0
  /** 成功完美格擋後按普攻可消耗的反擊窗口。 */
  counterReady = 0
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
    this.guardTimer = 0
    this.parryTimer = 0
    this.counterReady = 0
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
    // 蓄力優先於自動普攻脈衝，避免長按普攻把尚未消耗的 C 路線覆蓋掉。
    if (c.attack && this.buffered !== 'charge') this.bufferButton('attack')
    if (c.charge) this.bufferButton('charge')
    if (c.jump) this.jumpBuffer = BUFFER
    if (c.dodge) this.dodgeBuffer = BUFFER
    if (c.musou) this.musouBuffer = BUFFER
  }

  /** 暫停或焦點遺失時捨棄尚未執行的單次輸入，避免恢復後誤出招。 */
  clearQueuedActions(): void {
    this.buffered = null
    this.bufferAge = 0
    this.jumpBuffer = 0
    this.dodgeBuffer = 0
    this.musouBuffer = 0
  }

  update(dt: number, c: PlayerControls, aim: AimFn, arena: Arena): void {
    this.events.length = 0
    this.activeHits.length = 0
    this.bufferAge += dt
    if (this.bufferAge > BUFFER) this.buffered = null
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt)
    this.dodgeBuffer = Math.max(0, this.dodgeBuffer - dt)
    this.musouBuffer = Math.max(0, this.musouBuffer - dt)
    this.parryTimer = Math.max(0, this.parryTimer - dt)
    this.counterReady = Math.max(0, this.counterReady - dt)
    this.queue(c)
    this.invuln = Math.max(0, this.invuln - dt)
    this.stateTime += dt

    if (this.musouBuffer > 0 && this.musouReady && this.canMusou()) this.startMusou()
    else if (c.guard === true && this.canGuard()) this.startGuard()
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
        this.updateDodge(dt, c, aim)
        break
      case 'guard':
        this.updateGuard(dt, c, aim)
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
    if (this.state === 'guard' && this.isGuardingSource(fromX, fromZ)) {
      if (this.parryTimer > 0) {
        this.parryTimer = 0
        this.counterReady = COUNTER_TIME
        this.gainMusou(12)
        this.events.push({ type: 'parry' })
        return false
      }
      const blocked = heavy ? damage * 0.45 : damage * 0.25
      this.hp = Math.max(0, this.hp - blocked)
      this.gainMusou(heavy ? 3 : 2)
      this.events.push({ type: 'guardBlock', damage: blocked, heavy })
      if (this.hp <= 0) {
        this.state = 'dead'
        this.stateTime = 0
        this.counterReady = 0
        this.events.push({ type: 'death' })
      }
      return true
    }
    // 非格擋命中會中斷先前的完美格擋反擊權，不能把反擊帶進受傷狀態。
    this.counterReady = 0
    const armored = this.state === 'attack' && this.move?.armor === true
    this.hp = Math.max(0, this.hp - (armored ? damage * 0.5 : damage))
    this.gainMusou(4)
    if (this.hp <= 0) {
      this.state = 'dead'
      this.stateTime = 0
      this.move = null
      this.counterReady = 0
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
    return (this.state === 'move' || this.state === 'attack' || this.state === 'guard' || this.state === 'hurt') && this.pos.y < 0.05
  }

  private canGuard(): boolean {
    if (this.pos.y >= 0.05) return false
    if (this.state === 'move' || this.state === 'guard') return true
    return this.state === 'attack' && this.move !== null && this.move.airborne !== true && this.moveTime >= this.move.cancel
  }

  private startGuard(): void {
    if (this.state === 'guard') return
    this.state = 'guard'
    this.stateTime = 0
    this.move = null
    this.moveTime = 0
    this.normalCount = 0
    this.vel.set(0, 0, 0)
    this.guardTimer = 0
    this.parryTimer = PARRY_TIME
  }

  private isGuardingSource(fromX: number, fromZ: number): boolean {
    const dx = fromX - this.pos.x
    const dz = fromZ - this.pos.z
    const distance = Math.hypot(dx, dz) || 1
    return (Math.sin(this.facing) * dx + Math.cos(this.facing) * dz) / distance >= GUARD_ARC_COS
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
    this.counterReady = 0
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
    if (this.counterReady > 0 && this.buffered === 'attack') {
      this.counterReady = 0
      this.startMove('COUNTER', c, aim)
      return
    }
    if (this.jumpBuffer > 0) {
      this.startJump(c)
      return
    }
    if (this.buffered !== null) {
      const next = nextMove({ current: null, normalCount: 0, airborne: false, canChain: true }, this.buffered)
      if (next !== null) this.startMove(next, c, aim)
    }
  }

  private updateGuard(dt: number, c: PlayerControls, aim: AimFn): void {
    this.guardTimer += dt
    this.speed = 0
    if (c.moveX * c.moveX + c.moveZ * c.moveZ > 0.01) {
      this.facing = dampAngle(this.facing, Math.atan2(c.moveX, c.moveZ), 10, dt)
    }
    if (this.counterReady > 0 && this.buffered === 'attack') {
      this.counterReady = 0
      this.startMove('COUNTER', c, aim)
      return
    }
    if (c.guard !== true) {
      this.toMove()
      return
    }
    if (this.dodgeBuffer > 0) this.startDodge(c)
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
      const lastHit = m.hits[m.hits.length - 1]?.t1 ?? 0
      if (this.buffered === null && m.airborne !== true && this.pos.y <= 0.01 && hasInput && t >= lastHit) {
        this.toMove()
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

  private updateDodge(dt: number, c: PlayerControls, aim: AimFn): void {
    const v = DODGE_SPEED * (1 - smoothstep(0.08, DODGE_TIME, this.stateTime))
    this.pos.x += this.dodgeDir.x * v * dt
    this.pos.z += this.dodgeDir.z * v * dt
    this.speed = v
    if (this.stateTime >= DASH_CANCEL_TIME && this.buffered === 'attack') {
      this.startMove('DASH', c, aim)
      return
    }
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
