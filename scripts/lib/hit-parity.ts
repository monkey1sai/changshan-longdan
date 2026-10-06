import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { MOVES, type HitWindow, type MoveId } from '../../src/combat/moves.ts'
import { Arena } from '../../src/entities/arena.ts'
import { BODY_RADIUS, EnemyStore, Kind, type HitInfo } from '../../src/entities/enemies.ts'
import { MUSOU_MAX, Player, type AimFn, type PlayerControls } from '../../src/entities/player.ts'
import { PLAY_LIMIT, PLAYER_START, obstacles } from '../../src/world/layout.ts'

// E05 reference data: the unmodified Web player hitting static soldiers through EnemyStore.applyHit, in the order of
// Battle.step (hit-stop queues input only; otherwise player update, then player hits, then the dragon-like source).
// Soldiers never run update(), so they stay where they spawn; reactions and AI are later steps.

export const HIT_PARITY_SOURCES = [
  'src/entities/player.ts', 'src/entities/enemies.ts', 'src/combat/moves.ts', 'src/combat/hitshape.ts', 'src/combat/combo.ts',
  'src/core/math.ts', 'src/core/spatial-hash.ts', 'src/entities/battle.ts', 'src/entities/dragon-strike.ts', 'src/game.ts',
  'scripts/lib/hit-parity.ts',
] as const

type Button = 'attack' | 'charge' | 'jump' | 'dodge' | 'musou'
interface Target { x: number; z: number; y?: number; scale?: number; hp?: number }
// Presses follow the game, not the clock: hit-stop delays every chain, so press k waits until k moves have started and
// the latest has run `after` seconds (or, for 'hitstop', until a hit-stop is in progress).
type Step = [Button, number | 'hitstop']
interface HitScenario {
  id: string
  duration: number
  chain: Step[]
  gain?: number
  targets: Target[]
  // A second attacker like the musou dragon: a fresh stamp every `every` seconds, applied each frame after player hits.
  foreign?: { every: number; window: HitWindow; at: [number, number, number] }
  rates?: number[]
  divergent?: boolean // Unity intentionally differs from the Web here (see the scenario comment)
  expectMoves: MoveId[] // exact sequence of started moves
}

const S = PLAYER_START
const RATES = [30, 60, 120]
const attacks = (n: number): Step[] => Array.from({ length: n }, () => ['attack', 0.05])

// Deterministic, deliberately asymmetric layouts in front of the player (front is -Z): no two soldiers at the same
// distance from the player, so Battle's nearest-soldier auto-aim never depends on spatial-hash iteration order.
function crowd(n: number): Target[] {
  if (n === 1) return [{ x: 0.13, z: S.z - 2.1 }]
  const out: Target[] = []
  for (let i = 0; i < n; i++) {
    const ring = n === 5 ? 0 : Math.floor(i / 7)
    const slot = n === 5 ? i : i % 7
    const count = n === 5 ? 5 : 7
    const angle = (slot - (count - 1) / 2) * (n === 5 ? 0.42 : 0.33) + 0.031 * (i + 1)
    const radius = 1.7 + ring * 1.15 + 0.017 * i
    out.push({ x: Math.sin(angle) * radius, z: S.z - Math.cos(angle) * radius })
  }
  return out
}

const ROUTES: Record<'N1' | 'N4' | 'C5' | 'MUSOU', Pick<HitScenario, 'duration' | 'chain' | 'gain' | 'expectMoves'>> = {
  N1: { duration: 0.8, chain: attacks(1), expectMoves: ['N1'] },
  N4: { duration: 2.2, chain: attacks(4), expectMoves: ['N1', 'N2', 'N3', 'N4'] },
  C5: { duration: 3.4, chain: [...attacks(4), ['charge', 0.05]], expectMoves: ['N1', 'N2', 'N3', 'N4', 'C5'] },
  MUSOU: { duration: 4.0, chain: [['musou', 0]], gain: MUSOU_MAX, expectMoves: ['MUSOU'] },
}

const ANCHOR: Target = { x: 0, z: S.z - 1.2, scale: 1, hp: 900 }

const DRAGON_LIKE: HitWindow = {
  t0: 0, t1: 0, shape: { kind: 'circle', range: 2.8 }, damage: 1, reaction: 'launch',
  push: 0, lift: 0, hitstop: 0, shake: 0, radial: true, yMin: -8, yMax: 2, sfx: 'light',
}

export const HIT_SCENARIOS: HitScenario[] = [
  ...(['N1', 'N4', 'C5', 'MUSOU'] as const).flatMap((move) => [1, 5, 20].map((n) => ({ id: `${move.toLowerCase()}_x${n}`, targets: crowd(n), ...ROUTES[move] }))),
  // Every MUSOU window, finisher included: soldiers tough enough (279 total damage) to survive the whole move.
  { id: 'musou_all_windows', ...ROUTES.MUSOU, duration: 4.4, targets: crowd(5).map((t) => ({ ...t, hp: 900 })) },
  // Boundaries: each sweep straddles the edge, so some soldiers must be hit and some missed. Auto-aim turns toward the
  // nearest soldier, so lateral sweeps get an anchor soldier straight ahead (x = 0) that keeps the facing at PI.
  { id: 'n1_reach_sweep', ...ROUTES.N1, targets: Array.from({ length: 13 }, (_, i) => ({ x: 0.003 * i, z: S.z - 3.55 - 0.06 * i, scale: 1 })) },
  { id: 'n1_width_sweep', ...ROUTES.N1, targets: [ANCHOR, ...Array.from({ length: 11 }, (_, i) => ({ x: 0.88 + 0.04 * i, z: S.z - 2 - 0.011 * i, scale: 1 }))] },
  { id: 'n2_angle_sweep', duration: 1.1, chain: attacks(2), expectMoves: ['N1', 'N2'],
    targets: [ANCHOR, ...Array.from({ length: 12 }, (_, i) => { const a = (60 + 4 * i) * (Math.PI / 180); return { x: Math.sin(a) * (2.4 + 0.01 * i), z: S.z - 0.7 - Math.cos(a) * (2.4 + 0.01 * i), scale: 1 } })] },
  { id: 'n1_height_sweep', ...ROUTES.N1, targets: [2.45, 2.55, 2.65, 2.75, -0.45, -0.55, -0.65, -0.75].map((y, i) => ({ x: 0.05 * i - 0.2, z: S.z - 2 - 0.013 * i, y, scale: 1 })) },
  // Cancel: dodging out of C5 before its finisher; the cancelled windows must not hit afterwards.
  { id: 'c5_dodge_cancel', duration: 3.0, chain: [...attacks(4), ['charge', 0.05], ['dodge', 0.85]], expectMoves: ['N1', 'N2', 'N3', 'N4', 'C5'], targets: crowd(5) },
  // Death: 10 HP soldiers die to their first hit; no later window may hit them again.
  { id: 'kill_stops_later_hits', ...ROUTES.N4, targets: crowd(5).map((t) => ({ ...t, hp: 10 })) },
  // Fast crossing: at 20 Hz each step (0.05 s) is longer than a C5 jab window (0.04 s); each window must still hit once.
  // One soldier straight ahead, far enough that the N1-N4 lunges and C5's own lunges never carry the player past it.
  { id: 'c5_windows_shorter_than_step', ...ROUTES.C5, targets: [{ x: 0, z: S.z - 5, scale: 1, hp: 900 }], rates: [20, 60] },
  // Hit-stop from a hit delays the player; a charge pressed during it is consumed exactly once afterwards.
  { id: 'hitstop_charge_once', duration: 1.4, chain: [['attack', 0], ['charge', 'hitstop']], expectMoves: ['N1', 'C2'], targets: crowd(1).map((t) => ({ ...t, hp: 400 })) },
  // Interleaving: a dragon-like source hits the same soldiers between frames of one N1 window. The Web keeps only the
  // last stamp per soldier, so the N1 window hits a soldier again on every frame (and re-arms hit-stop each time);
  // Unity must hit each (window instance, soldier) once. Timelines diverge, so this case compares hit sets, not frames.
  { id: 'n1_interleaved_second_source', duration: 1.2, chain: attacks(1), expectMoves: ['N1'], divergent: true,
    targets: crowd(5).map((t) => ({ ...t, hp: 600 })), foreign: { every: 0.12, window: DRAGON_LIKE, at: [S.x, 0.5, S.z - 1.6] } },
]

const r = (v: number) => (Object.is(v, -0) ? 0 : v)
const WINDOW_KEYS = new Map((Object.keys(MOVES) as MoveId[]).flatMap((id) => MOVES[id].hits.map((w, i) => [w, `${id}:${i}`] as const)))


export function runHitScenario(s: HitScenario, hz: number) {
  const dt = 1 / hz
  const player = new Player()
  const arena = new Arena(PLAY_LIMIT, obstacles())
  player.reset(S.x, S.z, S.facing)
  const store = new EnemyStore(Math.max(1, s.targets.length))
  store.reset(s.targets.map((t) => ({ x: t.x, z: t.z, yaw: 0, kind: Kind.Spear })))
  // Overrides go straight into the store's typed arrays, then the spatial hash is rebuilt by the same reset path.
  s.targets.forEach((t, i) => {
    if (t.y !== undefined) store.y[i] = t.y
    if (t.scale !== undefined) store.scale[i] = t.scale
    if (t.hp !== undefined) store.hp[i] = store.maxHp[i] = t.hp
  })
  const targets = s.targets.map((_, i) => [store.x[i], store.y[i], store.z[i], store.scale[i], store.hp[i]])
  const aim: AimFn = (x, z, maxDist) => {
    const i = store.nearest(x, z, maxDist)
    return i < 0 ? null : { x: store.x[i], z: store.z[i] }
  }
  // Stamps are a global counter in the Web; name them by first appearance so both sides can be compared.
  const labels = new Map<number, string>()
  const label = (stamp: number, prefix: string) => {
    if (!labels.has(stamp)) labels.set(stamp, `${prefix}${[...labels.values()].filter((v) => v.startsWith(prefix)).length + 1}`)
    return labels.get(stamp)!
  }
  let hitstop = 0
  let foreignStamp = 0
  let foreignTimer = 0
  let stampSeed = 1_000_000 // foreign stamps never collide with the player's global counter values used here
  const out: HitInfo[] = []
  const started: string[] = []
  let next = 0
  const frames = []
  if (s.gain) player.gainMusou(s.gain)
  for (let frame = 0; frame < Math.round(s.duration * hz); frame++) {
    const c: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
    if (next < s.chain.length) {
      const [button, after] = s.chain[next]
      const ready = next === 0 || (started.length >= next && (after === 'hitstop' ? hitstop > 0 : hitstop <= 0 && player.moveTime >= after))
      if (ready) {
        c[button] = true
        next++
      }
    }
    const hits: (string | number)[][] = []
    if (hitstop > 0) {
      hitstop -= dt
      player.queue(c)
    } else {
      player.update(dt, c, aim, arena)
      for (const e of player.events) if (e.type === 'moveStart') started.push(e.moveId)
      for (const h of player.activeHits) {
        out.length = 0
        const name = `${label(h.stamp, 'P')}=${WINDOW_KEYS.get(h.window)}`
        store.applyHit(h.stamp, h.window, h.x, h.y, h.z, h.facing, out)
        if (out.length > 0) {
          hitstop = Math.max(hitstop, h.window.hitstop)
          player.gainMusou(Math.min(9, out.length * 1.4))
        }
        for (const hit of out) hits.push([name, hit.id, hit.killed ? 1 : 0, store.hp[hit.id]])
      }
      if (s.foreign) {
        foreignTimer -= dt
        if (foreignTimer <= 0) {
          foreignTimer = s.foreign.every
          foreignStamp = ++stampSeed
        }
        out.length = 0
        store.applyHit(foreignStamp, s.foreign.window, ...s.foreign.at, 0, out)
        for (const hit of out) hits.push([label(foreignStamp, 'F'), hit.id, hit.killed ? 1 : 0, store.hp[hit.id]])
      }
    }
    hits.sort((a, b) => (a[0] === b[0] ? (a[1] as number) - (b[1] as number) : String(a[0]) < String(b[0]) ? -1 : 1))
    frames.push({
      c: [c.moveX, c.moveZ, c.attack, c.charge, c.jump, c.dodge, c.musou, c.guard === true].map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
      s: [player.state, player.move?.id ?? '', r(player.moveTime), r(player.pos.x), r(player.pos.y), r(player.pos.z), r(player.facing), r(player.musou)],
      hs: r(hitstop),
      ...(hits.length ? { h: hits } : {}),
    })
  }
  if (started.join(',') !== s.expectMoves.join(',')) throw new Error(`${s.id}@${hz}: started ${started.join(',')}, expected ${s.expectMoves.join(',')}`)
  if (next !== s.chain.length) throw new Error(`${s.id}@${hz}: only ${next} of ${s.chain.length} presses happened`)
  return { id: s.id, hz, divergent: s.divergent === true, gain: s.gain ?? 0, bodyRadius: BODY_RADIUS, targets, foreign: s.foreign ? { every: s.foreign.every, at: s.foreign.at, window: windowRecord(s.foreign.window) } : null, frames }
}

function windowRecord(w: HitWindow) {
  return { kind: w.shape.kind, range: w.shape.range, damage: w.damage, hitstop: w.hitstop, yMin: w.yMin ?? null, yMax: w.yMax ?? null, radial: w.radial === true }
}

export function buildHitFixture(root: URL) {
  const sources = Object.fromEntries(HIT_PARITY_SOURCES.map((file) => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]))
  return {
    schemaVersion: 1,
    note: 'Generated by scripts/combat-parity.mjs from the Web source. Do not edit by hand.',
    sources,
    stateFields: ['state', 'move', 'moveTime', 'x', 'y', 'z', 'facing', 'musou'],
    hitFields: ['attack instance=window', 'soldier', 'killed', 'hpAfter'],
    scenarios: HIT_SCENARIOS.flatMap((s) => (s.rates ?? RATES).map((hz) => runHitScenario(s, hz))),
  }
}
