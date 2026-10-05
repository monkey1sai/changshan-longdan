import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { MOVES, type MoveDef, type MoveId } from '../../src/combat/moves.ts'
import { Input, type InputFrame } from '../../src/core/input.ts'
import { Arena } from '../../src/entities/arena.ts'
import { MUSOU_MAX, Player, type AimFn, type PlayerControls, type PlayerEvent } from '../../src/entities/player.ts'
import { PLAY_LIMIT, PLAYER_START, obstacles } from '../../src/world/layout.ts'

// E04 reference data: the production Web player, input and move code driven frame by frame, so the Unity port can be
// replayed against it. Times are converted to frames here once; the Unity side consumes per-frame data only.

export const PARITY_RATES = [30, 60, 120] as const
export const PARITY_SOURCES = [
  'src/entities/player.ts', 'src/combat/moves.ts', 'src/combat/combo.ts', 'src/combat/hitshape.ts',
  'src/core/math.ts', 'src/core/input.ts', 'src/entities/arena.ts', 'src/world/layout.ts', 'scripts/lib/combat-parity.ts',
] as const

type Button = 'attack' | 'charge' | 'jump' | 'dodge' | 'musou'
type Op = ['hitstop', number] | ['clear'] | ['hit', number, boolean, number, number] | ['gain', number] | ['reset']
interface Hold { from: number; to: number; move?: [number, number]; guard?: boolean }
interface PlayerScenario { id: string; duration: number; holds: Hold[]; presses: [number, Button][]; ops: [number, Op][] }

const S = PLAYER_START
const front: [number, number] = [S.x, S.z - 2] // start facing is PI, so the front is -Z
const behind: [number, number] = [S.x, S.z + 2]
const taps = (button: Button, ...at: number[]): [number, Button][] => at.map((t) => [t, button])

export const PLAYER_SCENARIOS: PlayerScenario[] = [
  { id: 'run_turn_stop', duration: 1.3, holds: [{ from: 0, to: 0.5, move: [1, 0] }, { from: 0.5, to: 0.9, move: [0, 1] }], presses: [], ops: [] },
  { id: 'normal_chain_early', duration: 2.6, holds: [], presses: taps('attack', 0, 0.08, 0.3, 0.55, 0.85, 1.15, 1.45), ops: [] },
  { id: 'late_press_starts_over', duration: 1.6, holds: [], presses: taps('attack', 0, 1.0), ops: [] },
  { id: 'charge_after_n2', duration: 2.0, holds: [], presses: [...taps('attack', 0, 0.25), [0.5, 'charge']], ops: [] },
  { id: 'charge_after_n4', duration: 2.8, holds: [], presses: [...taps('attack', 0, 0.25, 0.5, 0.75), [1.1, 'charge']], ops: [] },
  { id: 'charge_after_n5', duration: 3.6, holds: [], presses: [...taps('attack', 0, 0.3, 0.55, 0.85, 1.2), [1.6, 'charge']], ops: [] },
  { id: 'charge_wins_same_frame', duration: 1.0, holds: [], presses: [[0, 'attack'], [0, 'charge']], ops: [] },
  { id: 'jump_attacks', duration: 2.4, holds: [], presses: [[0, 'jump'], [0.25, 'attack'], [1.25, 'jump'], [1.5, 'charge']], ops: [[1.2, ['reset']]] },
  { id: 'dodge_dash_and_cancel', duration: 1.8, holds: [{ from: 0, to: 0.1, move: [0, -1] }], presses: [[0, 'dodge'], [0.15, 'attack'], [1.0, 'attack'], [1.2, 'dodge']], ops: [] },
  { id: 'back_dodge', duration: 0.8, holds: [], presses: [[0.05, 'dodge']], ops: [] },
  { id: 'guard_parry_counter', duration: 1.2, holds: [{ from: 0, to: 0.6, guard: true }], presses: [[0.2, 'attack']], ops: [[0.05, ['hit', 20, false, ...front]]] },
  { id: 'guard_block_then_side_hit', duration: 1.4, holds: [{ from: 0, to: 1.0, guard: true }], presses: [], ops: [[0.4, ['hit', 20, true, ...front]], [0.6, ['hit', 20, false, ...behind]]] },
  { id: 'heavy_hit_down', duration: 2.0, holds: [], presses: [], ops: [[0.1, ['hit', 30, true, ...front]]] },
  { id: 'armor_absorbs_hit', duration: 2.2, holds: [], presses: [...taps('attack', 0, 0.25, 0.5), [0.75, 'charge']], ops: [[1.3, ['hit', 40, false, ...front]]] },
  { id: 'musou_walk', duration: 3.9, holds: [{ from: 0.4, to: 1.4, move: [0, 1] }], presses: [[0.05, 'musou']], ops: [[0, ['gain', MUSOU_MAX]]] },
  { id: 'hitstop_keeps_input', duration: 1.4, holds: [], presses: [[0, 'attack'], [0.15, 'charge']], ops: [[0.12, ['hitstop', 0.1]]] },
  { id: 'clear_drops_buffer', duration: 1.0, holds: [], presses: [[0, 'attack'], [0.1, 'charge']], ops: [[0.15, ['clear']]] },
  { id: 'reset_restores', duration: 1.2, holds: [], presses: [[0, 'attack']], ops: [[0.1, ['gain', 50]], [0.3, ['hit', 25, false, ...front]], [0.8, ['reset']]] },
  { id: 'lethal_hit', duration: 0.6, holds: [], presses: [[0.3, 'attack']], ops: [[0.1, ['hit', 1200, true, ...front]]] },
  { id: 'arena_obstacle_and_edge', duration: 6.6, holds: [{ from: 0, to: 4.2, move: [-1, 0] }, { from: 4.2, to: 6.4, move: [0, 1] }], presses: [], ops: [] },
]

type KeyEvent = ['down', string] | ['repeat', string] | ['up', string] | ['mousedown', number] | ['mouseup', number] | ['blur']
interface InputScenario { id: string; duration: number; events: [number, KeyEvent][] }
const press = (code: string, at: number, up: number): [number, KeyEvent][] => [[at, ['down', code]], [up, ['up', code]]]

export const INPUT_SCENARIOS: InputScenario[] = [
  { id: 'keys_and_diagonal', duration: 1.2, events: [...press('KeyW', 0, 0.6), ...press('KeyD', 0.2, 0.8), ...press('KeyJ', 0.3, 0.32),
    ...press('KeyK', 0.4, 0.42), ...press('Space', 0.5, 0.52), ...press('ShiftLeft', 0.6, 0.62), ...press('KeyL', 0.7, 0.72),
    ...press('KeyF', 0.8, 1.0), ...press('ArrowLeft', 0.9, 1.1), ...press('ArrowDown', 0.9, 1.1)] },
  { id: 'attack_hold_repeat_then_charge', duration: 1.4, events: [...press('KeyJ', 0, 1.2), ...press('KeyK', 0.5, 0.52)] },
  { id: 'mouse_attack_and_charge', duration: 1.0, events: [[0, ['mousedown', 0]], [0.6, ['mouseup', 0]], [0.7, ['mousedown', 2]]] },
  { id: 'blur_clears_held', duration: 1.0, events: [...press('KeyJ', 0, 0.9), ...press('KeyW', 0, 0.9), [0.3, ['blur']]] },
  { id: 'guard_stops_repeat', duration: 1.0, events: [...press('KeyF', 0, 0.8), ...press('KeyJ', 0.1, 0.8)] },
  { id: 'os_key_repeat_ignored', duration: 0.6, events: [[0, ['down', 'KeyK']], [0.1, ['repeat', 'KeyK']], [0.2, ['repeat', 'KeyK']], [0.3, ['up', 'KeyK']]] },
]

// Yaws used to check camera-relative composition (game.simulate); PI is the start view.
export const COMPOSE_YAWS = [Math.PI, 0.7] as const

const frameOf = (t: number, hz: number) => Math.max(0, Math.ceil(t * hz - 1e-9))
const IDLE: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
const noAim: AimFn = () => null
const r = (value: number) => (Object.is(value, -0) ? 0 : value)

function snapshot(p: Player): (string | number)[] {
  return [p.state, p.move?.id ?? '', p.moveTime, p.stateTime, p.pos.x, p.pos.y, p.pos.z, p.vel.x, p.vel.y, p.vel.z, p.facing,
    p.hp, p.musou, p.invuln, p.normalCount, p.counterReady, p.parryTimer, p.guardTimer, p.speed, p.runPhase, p.dodgeBack ? 1 : 0]
    .map((v) => (typeof v === 'number' ? r(v) : v))
}

function eventText(e: PlayerEvent): string {
  switch (e.type) {
    case 'moveStart': return `moveStart:${e.moveId}`
    case 'swing': case 'land': case 'hurt': return `${e.type}:${e.heavy ? 1 : 0}`
    case 'guardBlock': return `guardBlock:${e.damage}:${e.heavy ? 1 : 0}`
    case 'fx': return `fx:${e.fx}:${e.radius}`
    default: return e.type
  }
}

function controlsAt(s: PlayerScenario, frame: number, hz: number): PlayerControls {
  const c: PlayerControls = { ...IDLE }
  for (const h of s.holds) {
    if (frameOf(h.from, hz) <= frame && frame < frameOf(h.to, hz)) {
      if (h.move) [c.moveX, c.moveZ] = h.move
      if (h.guard) c.guard = true
    }
  }
  for (const [at, button] of s.presses) if (frameOf(at, hz) === frame) c[button] = true
  return c
}

export function runPlayerScenario(s: PlayerScenario, hz: number) {
  const dt = 1 / hz
  const player = new Player()
  const arena = new Arena(PLAY_LIMIT, obstacles())
  player.reset(S.x, S.z, S.facing)
  let hitstop = 0
  const frames = []
  for (let frame = 0; frame < Math.round(s.duration * hz); frame++) {
    const ops = s.ops.filter(([at]) => frameOf(at, hz) === frame).map(([, op]) => op)
    for (const op of ops) {
      if (op[0] === 'hitstop') hitstop = Math.max(hitstop, op[1])
      else if (op[0] === 'clear') player.clearQueuedActions()
      else if (op[0] === 'hit') player.takeHit(op[1], op[2], op[3], op[4])
      else if (op[0] === 'gain') player.gainMusou(op[1])
      else { player.reset(S.x, S.z, S.facing); hitstop = 0 }
    }
    // takeHit events are read by Game before the next update clears them; keep them separately.
    const opEvents = ops.length ? player.events.map(eventText) : []
    const c = controlsAt(s, frame, hz)
    // Same order as Game.simulate: hit-stop only records presses, then the player updates.
    if (hitstop > 0) {
      hitstop -= dt
      player.queue(c)
    } else player.update(dt, c, noAim, arena)
    frames.push({
      c: [c.moveX, c.moveZ, c.attack, c.charge, c.jump, c.dodge, c.musou, c.guard === true].map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
      ...(ops.length ? { op: ops, oe: opEvents } : {}),
      s: snapshot(player),
      e: player.events.map(eventText),
      h: player.activeHits.map((a) => player.move?.hits.indexOf(a.window) ?? -1),
    })
  }
  return { id: s.id, hz, frames }
}

export function runInputScenario(s: InputScenario, hz: number) {
  const dt = 1 / hz
  const target = new EventTarget()
  const surface = new EventTarget()
  const input = new Input(target as unknown as Window, surface as unknown as HTMLElement)
  const send = (on: EventTarget, type: string, extra: object) => on.dispatchEvent(Object.assign(new Event(type), extra))
  const frames = []
  for (let frame = 0; frame < Math.round(s.duration * hz); frame++) {
    const events = s.events.filter(([at]) => frameOf(at, hz) === frame).map(([, e]) => e)
    for (const e of events) {
      if (e[0] === 'down' || e[0] === 'repeat') send(target, 'keydown', { code: e[1], repeat: e[0] === 'repeat' })
      else if (e[0] === 'up') send(target, 'keyup', { code: e[1] })
      else if (e[0] === 'mousedown') send(surface, 'mousedown', { button: e[1] })
      else if (e[0] === 'mouseup') send(target, 'mouseup', { button: e[1] })
      else target.dispatchEvent(new Event('blur'))
    }
    const f: InputFrame = input.poll(dt)
    frames.push({
      ...(events.length ? { ev: events } : {}),
      out: [f.moveX, f.moveY, f.attack, f.charge, f.jump, f.dodge, f.musou, f.guard === true].map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : r(v))),
      composed: COMPOSE_YAWS.map((yaw) => compose(f, yaw).map(r)),
    })
  }
  return { id: s.id, hz, frames }
}

// Game.simulate's camera-relative movement with CameraRig's basis for a given yaw.
export function compose(f: InputFrame, yaw: number): [number, number] {
  const forward = [Math.sin(yaw), Math.cos(yaw)]
  const right = [-Math.cos(yaw), Math.sin(yaw)]
  let mx = forward[0] * f.moveY + right[0] * f.moveX
  let mz = forward[1] * f.moveY + right[1] * f.moveX
  const len = Math.hypot(mx, mz)
  if (len > 1) {
    mx /= len
    mz /= len
  }
  return [mx, mz]
}

function moveRecord(m: MoveDef) {
  return {
    name: m.name, duration: m.duration, cancel: m.cancel, armor: m.armor === true, airborne: m.airborne === true,
    hits: m.hits.map((w) => ({
      t0: w.t0, t1: w.t1, kind: w.shape.kind, range: w.shape.range, offset: w.shape.offset ?? 0,
      halfAngle: w.shape.kind === 'arc' ? w.shape.halfAngle : 0, width: w.shape.kind === 'line' ? w.shape.width : 0,
      damage: w.damage, reaction: w.reaction, push: w.push, lift: w.lift, hitstop: w.hitstop, shake: w.shake, sfx: w.sfx,
      radial: w.radial === true, yMin: w.yMin ?? null, yMax: w.yMax ?? null, fx: w.fx ?? '',
    })),
    lunge: m.lunge.map((l) => [l.t0, l.t1, l.distance]),
    trail: m.trail, swings: m.swings,
    height: m.height ? { keys: m.height.keys, relative: m.height.relative === true } : null,
  }
}

export function buildParityFixture(root: URL) {
  const sources = Object.fromEntries(PARITY_SOURCES.map((file) => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]))
  return {
    schemaVersion: 1,
    note: 'Generated by scripts/combat-parity.mjs from the Web source. Do not edit by hand.',
    sources,
    snapshotFields: ['state', 'move', 'moveTime', 'stateTime', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'facing', 'hp', 'musou', 'invuln',
      'normalCount', 'counterReady', 'parryTimer', 'guardTimer', 'speed', 'runPhase', 'dodgeBack'],
    constants: { playLimit: PLAY_LIMIT, playerStart: S, musouMax: MUSOU_MAX, composeYaws: COMPOSE_YAWS,
      obstacles: obstacles().map((o) => [o.minX, o.maxX, o.minZ, o.maxZ]) },
    moves: Object.fromEntries((Object.keys(MOVES) as MoveId[]).map((id) => [id, moveRecord(MOVES[id])])),
    player: PLAYER_SCENARIOS.flatMap((s) => PARITY_RATES.map((hz) => runPlayerScenario(s, hz))),
    input: INPUT_SCENARIOS.flatMap((s) => PARITY_RATES.map((hz) => runInputScenario(s, hz))),
  }
}
