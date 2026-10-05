import type { Vector3Like } from 'three'
import type { HitWindow, MoveDef } from '../combat/moves.ts'
import { nextStamp } from '../combat/stamp.ts'
import { DIFFICULTIES, type DifficultyId, type DifficultyProfile } from '../core/difficulty.ts'
import type { Arena } from './arena.ts'
import { BattleDirector, type BattlePhase } from './battle-director.ts'
import { DRAGON_HIT, DragonStrike } from './dragon-strike.ts'
import { EnemyStore, type HitInfo, type KillInfo, type Spawn, type Strike } from './enemies.ts'
import { Player, type AimFn, type PlayerControls, type PlayerEvent, type PlayerState } from './player.ts'

/** 連擊數在最後一次命中後維持的秒數。 */
export const COMBO_WINDOW = 2.4
/** 每斬滿這麼多人送出一次 milestone。 */
export const KO_MILESTONE = 100
const PARRY_HITSTOP = 0.06
const SLOWMO_SCALE = 0.3
const VICTORY_SLOWMO = 1.6
const DEFEAT_SLOWMO = 1.2
const IDLE: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }

/** 一場戰鬥的場地與兵力；正式戰場見 castle-setup.ts，測試可換成小場景。 */
export interface BattleSetup {
  arena: Arena
  /** 每次 reset() 都重新產生一次敵兵配置。 */
  spawns: () => Spawn[]
  playerStart: { x: number; z: number; facing: number }
  capacity: number
  /** 魏兵 AI 亂數種子；省略時與正式戰場相同。 */
  enemySeed?: number
}

export type Outcome = 'ongoing' | 'victory' | 'defeat'
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D'

/** Player.update 產生、原樣轉入戰鬥事件流的事件；受擊結果改由 Battle 以帶位置的事件送出。 */
type ForwardedPlayerEvent = Exclude<PlayerEvent, { type: 'guardBlock' | 'parry' | 'hurt' | 'death' }>

/**
 * 一次 step（或 debug.injectStrike）中發生的事。
 * hit／dragonHit 的命中資料在 battle.hits[start, start + count)，kill 的擊破資料在 battle.kills[start, start + count)。
 */
export type BattleEvent =
  | ForwardedPlayerEvent
  | { type: 'hit'; window: HitWindow; start: number; count: number }
  | { type: 'dragonHit'; start: number; count: number; x: number; z: number }
  | { type: 'kill'; start: number; count: number }
  | { type: 'enemyStrike'; x: number; z: number; heavy: boolean }
  /** facing：結算當下趙雲的朝向（同一 step 之後的受傷可能再轉向）。 */
  | { type: 'parry'; x: number; z: number; facing: number }
  | { type: 'guardBlock'; x: number; z: number; facing: number; heavy: boolean; damage: number }
  | { type: 'hurt'; x: number; z: number; heavy: boolean }
  | { type: 'comboBreak' }
  | { type: 'musouReady' }
  | { type: 'milestone'; ko: number }
  | { type: 'halfDefeated' }
  | { type: 'phase'; id: BattlePhase['id'] }
  | { type: 'victory' }
  | { type: 'defeat' }

export interface BattleResult {
  win: boolean
  ko: number
  maxCombo: number
  seconds: number
  damage: number
  rank: Rank
}

/** 畫面讀取的趙雲狀態；只能讀，不能經由它改變戰鬥。 */
export interface PlayerView {
  readonly pos: Vector3Like
  readonly facing: number
  readonly state: PlayerState
  readonly stateTime: number
  readonly move: Readonly<MoveDef> | null
  readonly moveTime: number
  readonly speed: number
  readonly runPhase: number
  readonly dodgeBack: boolean
  readonly hp: number
  readonly maxHp: number
  readonly musou: number
  readonly musouReady: boolean
  readonly counterReady: number
}

/** 畫面讀取的魏兵 SoA 欄位；陣列以 ArrayLike 公開，元素同樣不可寫。 */
export interface EnemyView {
  readonly capacity: number
  readonly count: number
  readonly aliveCount: number
  readonly x: ArrayLike<number>
  readonly y: ArrayLike<number>
  readonly z: ArrayLike<number>
  readonly yaw: ArrayLike<number>
  readonly stateTime: ArrayLike<number>
  readonly flash: ArrayLike<number>
  readonly phase: ArrayLike<number>
  readonly moveBlend: ArrayLike<number>
  readonly spin: ArrayLike<number>
  readonly scale: ArrayLike<number>
  readonly state: ArrayLike<number>
  readonly kind: ArrayLike<number>
  readonly alive: ArrayLike<number>
  readonly engaged: ArrayLike<number>
}

export interface DragonView {
  readonly active: boolean
  readonly elapsed: number
  readonly striking: boolean
  readonly headPos: Vector3Like
}

/** 開發驗證與測試用的操作；都走正式的結算流程。 */
export interface BattleDebug {
  setMusou(value: number): void
  setHp(hp: number): void
  /** 立刻結算一次敵兵出手（格擋、受傷、敗北），結果寫入 battle.events。 */
  injectStrike(strike: Strike): void
  /** 對全場敵兵造成傷害，回傳命中人數；擊破在下一次 step 結算。 */
  damageAll(damage: number): number
}

export function rank(r: { win: boolean; ko: number; seconds: number; damage: number }): Rank {
  if (!r.win) return r.ko >= 200 ? 'B' : r.ko >= 100 ? 'C' : 'D'
  if (r.seconds < 300 && r.damage < 400) return 'S'
  if (r.seconds < 480) return 'A'
  return 'B'
}

/** 長坂一戰的規則：趙雲與魏兵互相結算、連擊、無雙、擊殺、勝敗。不碰 DOM 與 WebGL。 */
export class Battle {
  /** 本次 step 發生的事件，每次 step 開始時清空。 */
  readonly events: BattleEvent[] = []
  /** hit／dragonHit 事件引用的命中資料。 */
  readonly hits: HitInfo[] = []
  /** kill 事件引用的擊破資料。 */
  readonly kills: KillInfo[] = []
  /** 開發用的時間倍率；reset() 不會重設。 */
  timeScale = 1
  readonly debug: BattleDebug

  private readonly setup: BattleSetup
  private readonly zhaoYun = new Player()
  private readonly soldiers: EnemyStore
  private readonly dragonStrike = new DragonStrike()
  private readonly director = new BattleDirector()
  private profile: DifficultyProfile = DIFFICULTIES.normal
  private currentPhase: BattlePhase['id'] = 'opening'
  private readonly aim: AimFn = (x, z, maxDist) => {
    const i = this.soldiers.nearest(x, z, maxDist)
    return i < 0 ? null : { x: this.soldiers.x[i], z: this.soldiers.z[i] }
  }
  private readonly scratch: HitInfo[] = []
  private status: Outcome = 'ongoing'
  private spawnCount = 0
  private hitstopLeft = 0
  private slowmo = 0
  private time = 0
  private comboCount = 0
  private comboTimer = 0
  private comboBest = 0
  private koCount = 0
  private damageSum = 0
  private musouWasReady = false

  constructor(setup: BattleSetup) {
    this.setup = setup
    this.soldiers = new EnemyStore(setup.capacity, setup.enemySeed)
    this.debug = {
      setMusou: (value) => {
        this.zhaoYun.musou = value
      },
      setHp: (hp) => {
        this.zhaoYun.hp = hp
      },
      injectStrike: (strike) => {
        this.events.length = 0
        this.resolveStrike(strike)
        this.checkOutcome()
      },
      damageAll: (damage) => {
        const win: HitWindow = { ...DRAGON_HIT, shape: { kind: 'circle', range: 400 }, damage, yMin: -50, yMax: 50 }
        this.scratch.length = 0
        this.soldiers.applyHit(nextStamp(), win, this.zhaoYun.pos.x, 0, this.zhaoYun.pos.z, 0, this.scratch)
        return this.scratch.length
      },
    }
    this.reset()
  }

  get player(): PlayerView {
    return this.zhaoYun
  }

  get enemies(): EnemyView {
    return this.soldiers
  }

  get dragon(): DragonView {
    return this.dragonStrike
  }

  get difficulty(): DifficultyId {
    return this.profile.id
  }

  /** 目前的戰況階段；隨擊破數提高魏兵的壓力。 */
  get phase(): BattlePhase['id'] {
    return this.currentPhase
  }

  /** 剩餘的命中停頓秒數。 */
  get hitstop(): number {
    return this.hitstopLeft
  }

  get outcome(): Outcome {
    return this.status
  }

  get ko(): number {
    return this.koCount
  }

  get combo(): number {
    return this.comboCount
  }

  /** 連擊剩餘時間占連擊窗口的比例（0..1）。 */
  get comboTime(): number {
    return Math.max(0, this.comboTimer) / COMBO_WINDOW
  }

  get maxCombo(): number {
    return this.comboBest
  }

  get damageTaken(): number {
    return this.damageSum
  }

  /** 作戰時間；勝負分出後停止。 */
  get battleTime(): number {
    return this.time
  }

  /** 重新開戰；不指定難度時沿用上一場。 */
  reset(difficulty: DifficultyId = this.profile.id): void {
    const s = this.setup.playerStart
    const spawns = this.setup.spawns()
    this.profile = DIFFICULTIES[difficulty]
    this.zhaoYun.reset(s.x, s.z, s.facing)
    this.director.reset()
    this.currentPhase = 'opening'
    this.soldiers.setPressure(this.profile)
    this.soldiers.reset(spawns)
    this.dragonStrike.stop()
    this.spawnCount = spawns.length
    this.status = 'ongoing'
    this.hitstopLeft = 0
    this.slowmo = 0
    this.time = 0
    this.comboCount = 0
    this.comboTimer = 0
    this.comboBest = 0
    this.koCount = 0
    this.damageSum = 0
    this.musouWasReady = false
    this.events.length = 0
    this.hits.length = 0
    this.kills.length = 0
  }

  /** 暫停或失焦：捨棄尚未執行的單次輸入，避免恢復後誤出招。 */
  interrupt(): void {
    this.zhaoYun.clearQueuedActions()
  }

  /** 推進一幀；回傳實際推進的遊戲時間（命中停頓時為 0）。勝負分出後忽略輸入。 */
  step(realDt: number, controls: PlayerControls): number {
    this.events.length = 0
    this.hits.length = 0
    this.kills.length = 0
    const active = this.status === 'ongoing'
    const c = active ? controls : IDLE
    if (this.hitstopLeft > 0) {
      this.hitstopLeft -= realDt
      this.zhaoYun.queue(c)
      return 0
    }
    if (this.slowmo > 0) this.slowmo -= realDt
    const dt = realDt * (this.slowmo > 0 ? SLOWMO_SCALE : 1) * this.timeScale
    if (active) this.time += dt

    const pos = this.zhaoYun.pos
    this.zhaoYun.update(dt, c, this.aim, this.setup.arena)
    this.updatePressure()
    this.soldiers.update(dt, pos.x, pos.y, pos.z, this.setup.arena)
    this.forwardPlayerEvents()
    this.resolvePlayerHits()
    this.updateDragon(dt)
    this.resolveKills()
    for (const s of this.soldiers.strikes) this.resolveStrike(s)
    this.comboTimer -= dt
    if (this.comboTimer <= 0) this.comboCount = 0
    this.checkOutcome()
    const ready = this.zhaoYun.musouReady
    if (ready && !this.musouWasReady && this.status === 'ongoing') this.events.push({ type: 'musouReady' })
    this.musouWasReady = ready
    return dt
  }

  result(): BattleResult {
    const r = { win: this.status === 'victory', ko: this.koCount, maxCombo: this.comboBest, seconds: this.time, damage: this.damageSum }
    return { ...r, rank: rank(r) }
  }

  /** 依擊破數與難度決定魏兵的交戰距離與同時攻擊人數。 */
  private updatePressure(): void {
    const pressure = this.director.update(this.koCount, this.profile)
    this.soldiers.setPressure(this.profile, pressure.engageRange, pressure.maxAttackers)
    if (pressure.phase.id === this.currentPhase) return
    this.currentPhase = pressure.phase.id
    this.events.push({ type: 'phase', id: this.currentPhase })
  }

  private forwardPlayerEvents(): void {
    for (const ev of this.zhaoYun.events) {
      switch (ev.type) {
        case 'guardBlock':
        case 'parry':
        case 'hurt':
        case 'death':
          break
        case 'musouStart':
          this.dragonStrike.start(this.zhaoYun.pos, this.zhaoYun.facing)
          this.events.push(ev)
          break
        default:
          this.events.push(ev)
      }
    }
  }

  private resolvePlayerHits(): void {
    for (const h of this.zhaoYun.activeHits) {
      const start = this.hits.length
      this.soldiers.applyHit(h.stamp, h.window, h.x, h.y, h.z, h.facing, this.hits)
      const count = this.hits.length - start
      if (count === 0) continue
      this.hitstopLeft = Math.max(this.hitstopLeft, h.window.hitstop)
      this.addCombo(count)
      this.zhaoYun.gainMusou(Math.min(9, count * 1.4))
      this.events.push({ type: 'hit', window: h.window, start, count })
    }
  }

  private updateDragon(dt: number): void {
    if (!this.dragonStrike.active) return
    this.dragonStrike.update(dt, this.zhaoYun.pos, this.zhaoYun.facing)
    if (!this.dragonStrike.striking) return
    const head = this.dragonStrike.headPos
    const start = this.hits.length
    this.soldiers.applyHit(this.dragonStrike.stamp, DRAGON_HIT, head.x, head.y, head.z, 0, this.hits)
    const count = this.hits.length - start
    if (count === 0) return
    this.addCombo(count)
    this.events.push({ type: 'dragonHit', start, count, x: head.x, z: head.z })
  }

  private resolveKills(): void {
    const kills = this.soldiers.kills
    if (kills.length === 0) return
    const before = this.koCount
    const start = this.kills.length
    for (const k of kills) this.kills.push(k)
    this.events.push({ type: 'kill', start, count: kills.length })
    this.koCount += kills.length
    kills.length = 0
    if (this.soldiers.aliveCount === 0) return
    const half = Math.ceil(this.spawnCount / 2)
    if (Math.floor(before / KO_MILESTONE) < Math.floor(this.koCount / KO_MILESTONE)) {
      this.events.push({ type: 'milestone', ko: Math.floor(this.koCount / KO_MILESTONE) * KO_MILESTONE })
    } else if (before < half && this.koCount >= half) {
      this.events.push({ type: 'halfDefeated' })
    }
  }

  private resolveStrike(s: Strike): void {
    const p = this.zhaoYun
    this.events.push({ type: 'enemyStrike', x: s.x, z: s.z, heavy: s.heavy })
    const hpBefore = p.hp
    const eventStart = p.events.length
    const hurt = p.takeHit(s.damage, s.heavy, s.x, s.z)
    const outcome = p.events[eventStart]
    this.damageSum += hpBefore - p.hp
    if (p.hp > 0 && outcome?.type === 'parry') {
      this.hitstopLeft = Math.max(this.hitstopLeft, PARRY_HITSTOP)
      this.events.push({ type: 'parry', x: s.x, z: s.z, facing: p.facing })
      return
    }
    if (p.hp > 0 && outcome?.type === 'guardBlock') {
      this.events.push({ type: 'guardBlock', x: s.x, z: s.z, facing: p.facing, heavy: s.heavy, damage: outcome.damage })
      return
    }
    if (!hurt) return
    if (this.comboCount > 0) this.events.push({ type: 'comboBreak' })
    this.comboCount = 0
    this.comboTimer = 0
    this.events.push({ type: 'hurt', x: s.x, z: s.z, heavy: s.heavy })
  }

  private checkOutcome(): void {
    if (this.status !== 'ongoing') return
    if (this.soldiers.aliveCount === 0) {
      this.status = 'victory'
      this.slowmo = VICTORY_SLOWMO
      this.events.push({ type: 'victory' })
    } else if (this.zhaoYun.state === 'dead') {
      this.status = 'defeat'
      this.slowmo = DEFEAT_SLOWMO
      this.events.push({ type: 'defeat' })
    }
  }

  private addCombo(n: number): void {
    this.comboCount += n
    this.comboTimer = COMBO_WINDOW
    this.comboBest = Math.max(this.comboBest, this.comboCount)
  }
}
