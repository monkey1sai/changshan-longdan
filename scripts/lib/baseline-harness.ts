import { Frustum, Matrix4, Sphere, Vector3 } from 'three'
import { Game } from '../../src/game.ts'
import { Input, type InputFrame } from '../../src/core/input.ts'
import { createRng } from '../../src/core/math.ts'
import { MOVES, type MoveId } from '../../src/combat/moves.ts'
import { Battle } from '../../src/entities/battle.ts'
import { castleSetup } from '../../src/entities/castle-setup.ts'
import { Kind, type EnemyStore, type HitInfo } from '../../src/entities/enemies.ts'
import type { AimFn, Player, PlayerControls, PlayerEvent } from '../../src/entities/player.ts'
import { CameraRig } from '../../src/view/camera-rig.ts'
import { PLAYER_START } from '../../src/world/layout.ts'

export interface RawEvent {
  at: number
  type: 'keydown' | 'keyup' | 'blur' | 'focus'
  code?: string
}

export interface Scenario {
  id: string
  duration: number
  seed: number
  population: number
  near: boolean
  initialMove?: 'C4' | 'N2'
  initialMoveTime?: number
  events: readonly RawEvent[]
}

const tap = (at: number, code: string): RawEvent[] => [
  { at, type: 'keydown', code }, { at: at + 0.005, type: 'keyup', code },
]
const combo = { duration: 1.2, seed: 7, population: 1, near: false }
const hit = { duration: 0.32, seed: 7, near: true, initialMove: 'C4' as const, events: [] }
export const BASELINE_SCENARIOS: Record<string, Scenario> = {
  early_combo: { ...combo, id: 'early_combo', events: [...tap(0, 'KeyJ'), ...tap(0.08, 'KeyJ')] },
  hitstop_input: { ...combo, near: true, id: 'hitstop_input', events: [...tap(0, 'KeyJ'), ...tap(0.14, 'KeyK')] },
  pause_buffer: { ...combo, id: 'pause_buffer', events: [...tap(0, 'KeyJ'), ...tap(0.08, 'KeyK'), ...tap(0.12, 'Escape'), ...tap(0.24, 'Escape')] },
  blur_buffer: { ...combo, id: 'blur_buffer', events: [...tap(0, 'KeyJ'), ...tap(0.08, 'KeyK'), { at: 0.12, type: 'blur' }, { at: 0.22, type: 'focus' }, ...tap(0.24, 'Enter')] },
  hit_1: { ...hit, id: 'hit_1', population: 1 },
  hit_5: { ...hit, id: 'hit_5', population: 5 },
  hit_20: { ...hit, id: 'hit_20', population: 20 },
}

interface PlayerPort {
  stamps: number[]
  startMove(id: MoveId, controls: PlayerControls, aim: AimFn): void
}

// Explicit fixture ports into Battle's private state, not a new gameplay implementation.
interface BattlePort {
  zhaoYun: Player
  soldiers: EnemyStore
}

interface Kernel {
  battle: Battle
  rig: CameraRig
  input: Input
  mode: string
  clock: number
  simClock: number
  tick(dt: number, input: InputFrame, render: boolean): void
  setPaused(paused: boolean): void
}

const noop = () => {}
const idle: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }

function validateScenario(scenario: Scenario, hz: number): void {
  if (![30, 60, 120].includes(hz)) throw new Error('hz must be 30, 60 or 120')
  if (!Number.isInteger(scenario.seed) || scenario.seed < 0 || scenario.seed > 0xffffffff) throw new Error('invalid seed')
  if (!Number.isFinite(scenario.duration) || scenario.duration <= 0 || scenario.duration > 5) throw new Error('invalid duration')
  if (!Number.isInteger(scenario.population) || scenario.population < 1 || scenario.population > 20) throw new Error('invalid population')
  if (scenario.initialMove !== undefined && !['C4', 'N2'].includes(scenario.initialMove)) throw new Error('unsupported fixture move')
  if (scenario.initialMoveTime !== undefined && (!scenario.initialMove || !Number.isFinite(scenario.initialMoveTime) ||
    scenario.initialMoveTime < 0 || scenario.initialMoveTime >= MOVES[scenario.initialMove].duration)) throw new Error('invalid fixture move time')
  let previous = -Infinity
  for (const event of scenario.events) {
    if (!Number.isFinite(event.at) || event.at < 0 || event.at >= scenario.duration || event.at < previous) throw new Error('invalid event time/order')
    if (!['keydown', 'keyup', 'blur', 'focus'].includes(event.type)) throw new Error('unsupported event type')
    if (event.type === 'keydown' || event.type === 'keyup') {
      if (!['KeyJ', 'KeyK', 'Escape', 'Enter'].includes(event.code ?? '')) throw new Error('unsupported key in scoped fixture')
    }
    previous = event.at
  }
}

const port = (game: Kernel) => game.battle as unknown as BattlePort

function fixture(scenario: Scenario): { game: Kernel; target: EventTarget } {
  const target = new EventTarget()
  const surface = new EventTarget()
  const input = new Input(target as unknown as Window, surface as unknown as HTMLElement)
  const spawns = Array.from({ length: scenario.population }, (_, i) => ({
    x: scenario.near ? PLAYER_START.x + (scenario.population === 1 ? 0 : (i % 5 - 2) * 0.6) : 10,
    z: scenario.near ? PLAYER_START.z - 1.6 - Math.floor(i / 5) * 0.6 : 10,
    yaw: 0, kind: Kind.Spear,
  }))
  // The constructor's single reset applies the normal difficulty before spawning, as the real game does.
  const battle = new Battle({ ...castleSetup(), spawns: () => spawns.map(spawn => ({ ...spawn })),
    capacity: scenario.population, enemySeed: scenario.seed })
  const player = battle.player
  const rig = new CameraRig(16 / 9)
  rig.snap(player.pos, PLAYER_START.facing)
  const game = Object.assign(Object.create(Game.prototype), {
    battle, rig, input, difficulty: 'normal', mode: 'playing',
    clock: 0, simClock: 0, endTimer: 0, resultShown: false, controls: { ...idle },
    rng: createRng(99), tmp: new Vector3(),
    audio: null, music: null, perf: null,
    post: { focus: 9, musou: 0, flash: 0, aberration: 0, radial: 0, danger: 0, bars: 0, exposure: 1, dof: 0.8 },
    hud: { showBanner: noop }, screens: { showPause: noop, showResult: noop },
    sparks: { burst: noop, glitter: noop }, dust: { puff: noop },
    waves: { ring: noop }, fragments: { spawnSoldier: noop }, dragon: { active: false },
    // Only presentation is replaced. tick/simulate/Battle/mode transitions remain production methods.
    updateVisuals(dt: number, _simDt: number, frame: InputFrame) {
      rig.update(dt, player.pos, game.mode === 'playing' ? frame.camTurn : 0, frame.zoom, false, false, game.clock)
    },
  }) as Kernel
  // Input's blur listener was registered first, as in the real constructor.
  target.addEventListener('blur', () => game.setPaused(true))
  return { game, target }
}

function population(game: Kernel) {
  const store = port(game).soldiers
  let engaged = 0
  let tokens = 0
  let frustumProxy = 0
  const camera = game.rig.camera
  camera.updateMatrixWorld()
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  const sphere = new Sphere(new Vector3(), 1)
  for (let i = 0; i < store.count; i++) {
    if (!store.alive[i]) continue
    engaged += store.engaged[i]
    tokens += store.token[i]
    sphere.center.set(store.x[i], store.y[i] + store.scale[i], store.z[i])
    sphere.radius = store.scale[i]
    if (frustum.intersectsSphere(sphere)) frustumProxy++
  }
  if (tokens !== store.attackerCount) throw new Error('alive token/attackerCount invariant failed')
  return { alive: store.aliveCount, visible: null, frustumProxy, engaged, tokenAttackers: store.attackerCount }
}

function snapshot(game: Kernel) {
  const player = port(game).zhaoYun
  const battle = game.battle
  return {
    mode: game.mode, clock: game.clock, simClock: game.simClock, battleTime: battle.battleTime,
    hitstop: battle.hitstop, ko: battle.ko, combo: battle.combo, damageTaken: battle.damageTaken,
    player: { state: player.state, move: player.move?.id ?? null, moveTime: player.moveTime, stateTime: player.stateTime,
      hp: player.hp, musou: player.musou, facing: player.facing, position: player.pos.toArray() },
    population: population(game),
  }
}

interface HitOwner { attackOrdinal: number; moveId: MoveId; windowIndex: number }
interface HitRecord extends HitOwner { stamp: number; targets: HitInfo[] }
interface Frame {
  frame: number
  tickStartSec: number
  tickEndSec: number
  rawEvents: RawEvent[]
  input: InputFrame
  before: ReturnType<typeof snapshot>
  after: ReturnType<typeof snapshot>
  events: PlayerEvent[]
  hits: HitRecord[]
}

export function runScenario(scenario: Scenario, hz: number, options: { observe?: boolean } = {}) {
  validateScenario(scenario, hz)
  const observe = options.observe !== false
  const { game, target } = fixture(scenario)
  const frames: Frame[] = []
  const owners = new Map<number, HitOwner>()
  let attackOrdinal = 0
  let accepted: HitRecord[] = []
  const player = port(game).zhaoYun
  const playerPort = player as unknown as PlayerPort
  if (observe) {
    const originalStart = playerPort.startMove
    playerPort.startMove = function(id, controls, aim) {
      originalStart.call(this, id, controls, aim)
      const ordinal = ++attackOrdinal
      this.stamps.forEach((stamp, windowIndex) => owners.set(stamp, { attackOrdinal: ordinal, moveId: id, windowIndex }))
    }
  }
  /** Accepted player hits of the last tick, in Battle's resolution order. */
  const recordHits = () => {
    const battle = game.battle
    for (const event of battle.events) {
      if (event.type !== 'hit') continue
      const active = player.activeHits.find(hit => hit.window === event.window)
      const owner = active === undefined ? undefined : owners.get(active.stamp)
      if (active === undefined || owner === undefined || MOVES[owner.moveId].hits[owner.windowIndex] !== event.window) throw new Error('unmapped accepted hit owner')
      // Copy out of Battle's shared hit buffer; never infer owner from the post-tick move.
      const hits = battle.hits.slice(event.start, event.start + event.count)
      accepted.push({ ...owner, stamp: active.stamp, targets: hits.map(hit => ({ ...hit })) })
    }
  }
  if (scenario.initialMove) {
    playerPort.startMove(scenario.initialMove, { ...idle, moveZ: -1 }, () => null)
    if (scenario.initialMoveTime !== undefined) player.moveTime = scenario.initialMoveTime
  }
  let nextEvent = 0
  const totalFrames = Math.ceil(scenario.duration * hz)
  for (let frame = 0; frame < totalFrames; frame++) {
    const tickStartSec = frame / hz
    const rawEvents: RawEvent[] = []
    const before = observe ? snapshot(game) : null
    while (nextEvent < scenario.events.length && scenario.events[nextEvent].at <= tickStartSec + 1e-10) {
      const event = scenario.events[nextEvent++]
      rawEvents.push({ ...event })
      target.dispatchEvent(Object.assign(new Event(event.type, { cancelable: true }), { code: event.code, repeat: false }))
    }
    const input = game.input.poll(1 / hz)
    accepted = []
    const simBefore = game.simClock
    game.tick(1 / hz, input, false)
    if (observe) recordHits()
    if (observe && before) {
      frames.push({ frame, tickStartSec, tickEndSec: (frame + 1) / hz, rawEvents, input, before,
        after: snapshot(game), hits: accepted,
        // hitstop leaves the old producer arrays intact; they are not new events.
        events: game.simClock > simBefore ? player.events.map(event => ({ ...event })) : [],
      })
    }
  }
  const store = port(game).soldiers
  const rawHitStamps = Array.from(store.hitStamp.subarray(0, store.count))
  const nonzero = rawHitStamps.filter(stamp => stamp !== 0)
  const firstStamp = nonzero.length ? Math.min(...nonzero) : 0
  const finalEnemyState = Array.from({ length: store.count }, (_, i) => ({
    id: i, x: store.x[i], y: store.y[i], z: store.z[i], vx: store.vx[i], vy: store.vy[i], vz: store.vz[i],
    hp: store.hp[i], state: store.state[i], stateTime: store.stateTime[i], alive: store.alive[i],
    engaged: store.engaged[i], token: store.token[i], cooldown: store.cooldown[i],
    // Only a process-global ID offset is normalized, never gameplay stamp state.
    relativeHitStamp: rawHitStamps[i] === 0 ? 0 : rawHitStamps[i] - firstStamp + 1,
  }))
  return {
    scenario: { ...scenario, events: scenario.events.map(event => ({ ...event })) }, hz,
    quantization: { inputSamplingSec: 1 / hz, stateObservationSec: 1 / hz, maximumCombinedQuantizationSec: 2 / hz,
      excludes: 'legal cancel-window waiting, hitstop, pause; not input-to-photon latency' },
    fixture: { constructor: 'BYPASSED', initialization: 'fresh EnemyStore; one fixture reset, not natural first battle or retry',
      difficulty: 'normal', viewport: [960, 540], renderer: 'NOT_RUN', audio: 'NOT_RUN',
      visibility: { visible: 'NOT_MEASURED', proxy: 'camera frustum sphere; center y+scale, radius=scale', occlusion: 'NOT_MEASURED' },
      rng: { enemies: scenario.seed, feedback: 99, spawn: 'fixed fixture coordinates', colors: 'NOT_RUN' },
      stampNormalization: 'offset only in final comparison; raw stamps preserved',
      initialMove: scenario.initialMove ?? null, initialMoveTime: scenario.initialMoveTime ?? null },
    frames, final: snapshot(game), finalEnemyState, rawHitStamps,
  }
}
