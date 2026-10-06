import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { MOVES, type HitWindow, type MoveId } from '../../src/combat/moves.ts'
import { Arena } from '../../src/entities/arena.ts'
import { EnemyStore, Kind, State, type HitInfo } from '../../src/entities/enemies.ts'
import { MUSOU_MAX, Player, type AimFn, type PlayerControls } from '../../src/entities/player.ts'
import { PLAY_LIMIT, PLAYER_START, obstacles } from '../../src/world/layout.ts'

// E07 reference data: the unmodified Web soldier reactions (EnemyStore.damage and the reaction part of
// EnemyStore.update), the player's hurt loop (Player.takeHit through Battle.resolveStrike's rules) and the events
// presentation reacts to, replayed in Battle.step's order. The AI is E08: a soldier that is not reacting runs only the
// Web's Formation step (brake, face the player), a reaction that ends returns there (the Web returns to Engage/March),
// and strikes are injected like Battle.debug.injectStrike. Private EnemyStore members are called directly for that;
// tests/reaction-parity.test.ts checks the strike part against the real Battle.

export const REACTION_PARITY_SOURCES = [
  'src/entities/player.ts', 'src/entities/enemies.ts', 'src/entities/battle.ts', 'src/combat/moves.ts', 'src/combat/hitshape.ts',
  'src/core/math.ts', 'src/core/spatial-hash.ts', 'src/entities/arena.ts', 'scripts/lib/reaction-parity.ts',
] as const

type Button = 'attack' | 'charge' | 'jump' | 'dodge' | 'musou'
interface Target { x: number; z: number; yaw?: number; kind?: 'spear' | 'captain'; y?: number; scale?: number; hp?: number }
type Press = [Button, number]
type Hold = { from: number; to: number; guard?: boolean; move?: [number, number] }
/** A hit window applied once from (x, y, z) facing `facing` at `at` seconds, as a second source (fresh stamp). */
type Blow = { at: number; window: `${MoveId}:${number}`; x: number; y: number; z: number; facing: number }
type Strike = { at: number; damage: number; heavy: boolean; x: number; z: number }
interface ReactionScenario {
  id: string
  duration: number
  targets: Target[]
  presses?: Press[] // state-driven like hit-parity: press k waits until k moves started and the latest ran `after` seconds
  holds?: Hold[]
  blows?: Blow[]
  strikes?: Strike[]
  playerHp?: number
  gain?: number
  expectMoves?: MoveId[]
}

const S = PLAYER_START
export const REACTION_RATES = [30, 60, 120] as const
const attacks = (n: number): Press[] => Array.from({ length: n }, () => ['attack', 0.05])
const FRONT = { x: S.x, y: 0, z: S.z, facing: S.facing }
const blow = (at: number, window: Blow['window']): Blow => ({ at, window, ...FRONT })
const strike = (at: number, damage: number, heavy: boolean, dz = -2): Strike => ({ at, damage, heavy, x: S.x, z: S.z + dz })

// Same deliberately asymmetric crowd as hit-parity (no distance ties for auto-aim).
function crowd(n: number, kind?: Target['kind']): Target[] {
  if (n === 1) return [{ x: 0.13, z: S.z - 2.1, kind }]
  const out: Target[] = []
  for (let i = 0; i < n; i++) {
    const ring = n === 5 ? 0 : Math.floor(i / 7)
    const slot = n === 5 ? i : i % 7
    const count = n === 5 ? 5 : 7
    const angle = (slot - (count - 1) / 2) * (n === 5 ? 0.42 : 0.33) + 0.031 * (i + 1)
    const radius = 1.7 + ring * 1.15 + 0.017 * i
    out.push({ x: Math.sin(angle) * radius, z: S.z - Math.cos(angle) * radius, kind })
  }
  return out
}
const FAR = [{ x: 60, z: 60, kind: 'captain' as const }] // keeps the store non-empty without reaching the player
const tough = (targets: Target[]) => targets.map((t) => ({ ...t, hp: 400 }))
// 120 Hz frames are recorded every other step (the fixture stays under 4 MB); every step is still simulated.
export const REACTION_SAMPLE_EVERY: Record<number, number> = { 30: 1, 60: 1, 120: 2 }

export const REACTION_SCENARIOS: ReactionScenario[] = [
  // Reactions by type, applied as second-source windows so timing is exact; soldiers must recover to standing.
  { id: 'flinch_twice', duration: 1.6, targets: crowd(5), blows: [blow(0.1, 'N1:0'), blow(0.3, 'N4:1')] },
  { id: 'launch_juggle_land', duration: 3.6, targets: tough(crowd(5)), blows: [blow(0.1, 'C1:0'), blow(0.5, 'N1:0'), blow(0.7, 'C3:1')] },
  { id: 'knockback_crowd', duration: 2.0, targets: crowd(20), blows: [blow(0.1, 'N5:0')] },
  { id: 'blowaway_captain_and_soldier', duration: 3.2, targets: [{ x: -0.4, z: S.z - 2.0, kind: 'captain' }, { x: 0.5, z: S.z - 2.3 }], blows: [blow(0.1, 'N6:0')] },
  { id: 'knockdown_cycles', duration: 4.2, targets: tough(crowd(5)), blows: [blow(0.1, 'JA:0'), blow(0.8, 'JA:0'), blow(1.3, 'C1:0'), blow(1.5, 'JA:0')] },
  { id: 'getup_flinch', duration: 2.6, targets: crowd(5), blows: [blow(0.1, 'JC:0'), blow(1.45, 'N1:0')] },
  { id: 'captain_flinch_push', duration: 1.2, targets: crowd(5, 'captain'), blows: [blow(0.1, 'N1:0')] },
  { id: 'kill_velocities', duration: 1.0, targets: crowd(5).map((t) => ({ ...t, hp: 10 })), blows: [blow(0.1, 'C2:0'), blow(0.4, 'N5:0')] },
  // Player-driven strings into crowds: hit order, reactions and rng draws must follow the Web's spatial-hash order.
  { id: 'n6_string_crowd', duration: 3.4, targets: crowd(5).map((t, i) => ({ ...t, hp: i < 3 ? 200 : undefined })), presses: attacks(6), expectMoves: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'] },
  { id: 'c5_crowd', duration: 3.6, targets: crowd(20), presses: [...attacks(4), ['charge', 0.05]], expectMoves: ['N1', 'N2', 'N3', 'N4', 'C5'] },
  { id: 'musou_crowd', duration: 4.4, targets: crowd(20).map((t) => ({ ...t, hp: 400 })), presses: [['musou', 0]], gain: MUSOU_MAX, expectMoves: ['MUSOU'] },
  // The player's hurt loop (strikes injected like Battle.debug.injectStrike).
  { id: 'hurt_light', duration: 1.2, targets: FAR, strikes: [strike(0.2, 26, false)] },
  { id: 'hurt_heavy_down_invuln', duration: 3.4, targets: FAR, strikes: [strike(0.2, 70, true), strike(1.0, 26, false), strike(2.2, 26, false)] },
  { id: 'guard_parry_then_block', duration: 1.6, targets: FAR, holds: [{ from: 0.1, to: 1.5, guard: true }], strikes: [strike(0.15, 26, false), strike(1.0, 70, true)] },
  // C4 has armor: a heavy strike during it costs half damage and does not stagger.
  { id: 'armor_half_damage', duration: 2.4, targets: FAR, presses: [...attacks(3), ['charge', 0.05]], expectMoves: ['N1', 'N2', 'N3', 'C4'], strikes: [strike(0.95, 70, true)] },
  { id: 'death', duration: 1.0, targets: FAR, playerHp: 20, strikes: [strike(0.2, 26, false)] },
]

const r = (v: number) => (Object.is(v, -0) ? 0 : v)
const r6 = (v: number) => r(Math.round(v * 1e6) / 1e6)
const WINDOW_KEYS = new Map((Object.keys(MOVES) as MoveId[]).flatMap((id) => MOVES[id].hits.map((w, i) => [w, `${id}:${i}`] as const)))
const REACTING = new Set<number>([State.Flinch, State.Air, State.Knockback, State.Down, State.Getup])
const frameOf = (t: number, hz: number) => Math.max(0, Math.ceil(t * hz - 1e-9))

interface Internals {
  count: number; alive: Uint8Array; state: Uint8Array; stateTime: Float32Array; flash: Float32Array; cooldown: Float32Array
  vx: Float32Array; vz: Float32Array; moveBlend: Float32Array; phase: Float32Array; strikes: unknown[]
  step(i: number, dt: number, px: number, py: number, pz: number): void
  rebuildHash(): void
  separate(px: number, pz: number, arena: Arena): void
}

/** EnemyStore.update without engagement and tokens (E08): what Unity's HitTargets.Step does. */
function updateReactions(store: EnemyStore, dt: number, px: number, py: number, pz: number, arena: Arena): void {
  const s = store as unknown as Internals
  s.strikes.length = 0
  for (let i = 0; i < s.count; i++) {
    if (s.alive[i] === 0) continue
    s.flash[i] = Math.max(0, s.flash[i] - dt * 9)
    s.cooldown[i] -= dt
    s.stateTime[i] += dt
    if (!REACTING.has(s.state[i])) s.state[i] = State.Formation
    s.step(i, dt, px, py, pz)
    if (s.state[i] === State.March || s.state[i] === State.Engage) s.state[i] = State.Formation // recover() -> standing
    const speed = Math.hypot(s.vx[i], s.vz[i])
    s.moveBlend[i] = s.moveBlend[i] + (Math.min(1, speed / 3.5) - s.moveBlend[i]) * (1 - Math.exp(-10 * dt))
    s.phase[i] += speed * dt * 2.3
  }
  s.rebuildHash()
  s.separate(px, pz, arena)
}

export function runReactionScenario(s: ReactionScenario, hz: number) {
  const dt = 1 / hz
  const player = new Player()
  const arena = new Arena(PLAY_LIMIT, obstacles())
  player.reset(S.x, S.z, S.facing)
  if (s.playerHp !== undefined) player.hp = s.playerHp
  if (s.gain) player.gainMusou(s.gain)
  const store = new EnemyStore(s.targets.length)
  store.reset(s.targets.map((t) => ({ x: t.x, z: t.z, yaw: t.yaw ?? 0, kind: t.kind === 'captain' ? Kind.Captain : Kind.Spear })))
  s.targets.forEach((t, i) => {
    if (t.y !== undefined) store.y[i] = t.y
    if (t.scale !== undefined) store.scale[i] = t.scale
    if (t.hp !== undefined) store.hp[i] = store.maxHp[i] = t.hp
  })
  const spawns = s.targets.map((t, i) => ({ x: t.x, z: t.z, yaw: t.yaw ?? 0, kind: t.kind === 'captain' ? 2 : 0, y: t.y ?? null, scale: t.scale ?? null, hp: t.hp ?? null, rngHp: store.hp[i] }))
  const aim: AimFn = (x, z, maxDist) => {
    const i = store.nearest(x, z, maxDist)
    return i < 0 ? null : { x: store.x[i], z: store.z[i] }
  }
  const labels = new Map<number, string>()
  const label = (stamp: number) => {
    if (!labels.has(stamp)) labels.set(stamp, `P${labels.size + 1}`)
    return labels.get(stamp)!
  }
  let hitstop = 0
  let blowStamp = 1_000_000
  const out: HitInfo[] = []
  const started: MoveId[] = []
  let next = 0
  const frames = []
  const presses = s.presses ?? []
  for (let frame = 0; frame < Math.round(s.duration * hz); frame++) {
    const t = frame * dt
    const c: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
    for (const h of s.holds ?? []) {
      if (t + 1e-9 < h.from || t + 1e-9 >= h.to) continue
      if (h.guard) c.guard = true
      if (h.move) { c.moveX = h.move[0]; c.moveZ = h.move[1] }
    }
    if (next < presses.length) {
      const [button, after] = presses[next]
      if (next === 0 || (started.length >= next && hitstop <= 0 && player.moveTime >= after)) {
        c[button] = true
        next++
      }
    }
    const events: unknown[][] = []
    const stepped = hitstop <= 0
    if (!stepped) {
      hitstop -= dt
      player.queue(c)
    } else {
      player.update(dt, c, aim, arena)
      for (const e of player.events) if (e.type === 'moveStart') started.push(e.moveId)
      updateReactions(store, dt, player.pos.x, player.pos.y, player.pos.z, arena)
      for (const h of player.activeHits) {
        out.length = 0
        store.applyHit(h.stamp, h.window, h.x, h.y, h.z, h.facing, out)
        if (out.length === 0) continue
        hitstop = Math.max(hitstop, h.window.hitstop)
        player.gainMusou(Math.min(9, out.length * 1.4))
        events.push(['hit', `${label(h.stamp)}=${WINDOW_KEYS.get(h.window)}`, ...out.map((hit) => [hit.id, hit.killed ? 1 : 0, store.hp[hit.id], r6(hit.x), r6(hit.y), r6(hit.z), r6(hit.dirX), r6(hit.dirZ)])])
      }
      for (const b of s.blows ?? []) {
        if (frameOf(b.at, hz) !== frame) continue
        const [move, index] = b.window.split(':')
        const window: HitWindow = MOVES[move as MoveId].hits[Number(index)]
        out.length = 0
        store.applyHit(++blowStamp, window, b.x, b.y, b.z, b.facing, out)
        if (out.length === 0) continue
        events.push(['blow', b.window, ...out.map((hit) => [hit.id, hit.killed ? 1 : 0, store.hp[hit.id], r6(hit.x), r6(hit.y), r6(hit.z), r6(hit.dirX), r6(hit.dirZ)])])
      }
      if (store.kills.length > 0) {
        events.push(['kill', ...store.kills.map((k) => [k.id, r6(k.x), r6(k.y), r6(k.z), r6(k.vx), r6(k.vy), r6(k.vz), r6(k.yaw), r6(k.spin), k.kind])])
        store.kills.length = 0
      }
    }
    // Battle.debug.injectStrike: resolved after the step, with Battle.resolveStrike's rules.
    for (const st of s.strikes ?? []) {
      if (frameOf(st.at, hz) !== frame) continue
      events.push(['enemyStrike', st.x, st.z, st.heavy ? 1 : 0])
      const eventStart = player.events.length
      const hurt = player.takeHit(st.damage, st.heavy, st.x, st.z)
      const outcome = player.events[eventStart]
      if (player.hp > 0 && outcome?.type === 'parry') {
        hitstop = Math.max(hitstop, 0.06)
        events.push(['parry', st.x, st.z, r6(player.facing)])
      } else if (player.hp > 0 && outcome?.type === 'guardBlock') {
        events.push(['guardBlock', st.x, st.z, r6(player.facing), st.heavy ? 1 : 0, r6(outcome.damage)])
      } else if (hurt) events.push(['hurt', st.x, st.z, st.heavy ? 1 : 0])
    }
    if (frame % REACTION_SAMPLE_EVERY[hz] !== 0 && events.length === 0) continue
    const soldiers = []
    for (let i = 0; i < store.count; i++) {
      soldiers.push([store.state[i], store.alive[i], store.hp[i], r6(store.x[i]), r6(store.y[i]), r6(store.z[i]), r6(store.vx[i]), r6(store.vy[i]), r6(store.vz[i]),
        r6(store.yaw[i]), r6(store.spin[i]), store.spinVel[i], r6(store.flash[i]), r6(store.stateTime[i])])
    }
    frames.push({
      f: frame,
      c: [c.moveX, c.moveZ, c.attack, c.charge, c.jump, c.dodge, c.musou, c.guard === true].map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
      s: [player.state, player.move?.id ?? '', r6(player.moveTime), r6(player.pos.x), r6(player.pos.y), r6(player.pos.z), r6(player.facing), r6(player.musou), r6(player.hp), r6(player.invuln)],
      hs: r6(hitstop),
      ...(events.length ? { e: events } : {}),
      n: soldiers,
    })
  }
  if (s.expectMoves && started.join(',') !== s.expectMoves.join(',')) throw new Error(`${s.id}@${hz}: started ${started.join(',')}, expected ${s.expectMoves.join(',')}`)
  if (next !== presses.length) throw new Error(`${s.id}@${hz}: only ${next} of ${presses.length} presses happened`)
  return { id: s.id, hz, duration: s.duration, sampleEvery: REACTION_SAMPLE_EVERY[hz], spawns, playerHp: s.playerHp ?? null, gain: s.gain ?? 0, holds: s.holds ?? [], presses, blows: s.blows ?? [], strikes: s.strikes ?? [], frames }
}

export function buildReactionFixture(root: URL) {
  const sources = Object.fromEntries(REACTION_PARITY_SOURCES.map((file) => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]))
  return {
    schemaVersion: 1,
    note: 'Generated by scripts/combat-parity.mjs from the Web source. Do not edit by hand.',
    sources,
    stateFields: ['state', 'move', 'moveTime', 'x', 'y', 'z', 'facing', 'musou', 'hp', 'invuln'],
    soldierFields: ['state', 'alive', 'hp', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'spin', 'spinVel', 'flash', 'stateTime'],
    hitFields: ['soldier', 'killed', 'hpAfter', 'x', 'y', 'z', 'dirX', 'dirZ'],
    killFields: ['soldier', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'spin', 'kind'],
    scenarios: REACTION_SCENARIOS.flatMap((s) => REACTION_RATES.map((hz) => runReactionScenario(s, hz))),
  }
}
