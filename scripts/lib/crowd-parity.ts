import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { MOVES, type MoveId } from '../../src/combat/moves.ts'
import { DIFFICULTIES, type DifficultyId } from '../../src/core/difficulty.ts'
import { createRng } from '../../src/core/math.ts'
import { Arena } from '../../src/entities/arena.ts'
import { Battle, type BattleEvent } from '../../src/entities/battle.ts'
import { Kind, squadSpawns, type Spawn } from '../../src/entities/enemies.ts'
import type { Player, PlayerControls } from '../../src/entities/player.ts'
import { obstacles, PLAY_LIMIT, PLAYER_START, SQUADS } from '../../src/world/layout.ts'

// E08 reference data: the unmodified Web Battle end to end (EnemyStore AI: engagement, tokens, marching, circling,
// windup/strike/recover; the director's pressure; the four difficulties), driven frame by frame. Small groups are
// recorded in full for a few seconds (bit-level parity); the 300-soldier castle layout is summarised per second
// (invariants and counts), because a crowd pushing itself around is chaotic over long runs.

export const CROWD_PARITY_SOURCES = [
  'src/entities/enemies.ts', 'src/entities/battle.ts', 'src/entities/battle-director.ts', 'src/entities/player.ts', 'src/entities/arena.ts',
  'src/entities/castle-setup.ts', 'src/core/difficulty.ts', 'src/core/math.ts', 'src/core/spatial-hash.ts', 'src/combat/moves.ts',
  'src/combat/hitshape.ts', 'src/world/layout.ts', 'scripts/lib/crowd-parity.ts',
] as const

type Button = 'attack' | 'charge' | 'jump' | 'dodge' | 'musou'
type Press = [number, Button] // at seconds (clock-driven: the AI's timing is what is under test)
type Hold = { from: number; to: number; guard?: boolean; move?: [number, number] }
interface CrowdScenario {
  id: string
  duration: number
  difficulty: DifficultyId
  spawns: Spawn[]
  presses?: Press[]
  holds?: Hold[]
  summary?: boolean // per-second summary instead of frames (large crowds)
  rates?: number[]
}

const S = PLAYER_START
export const CROWD_RATES = [30, 60, 120] as const
export const CROWD_SAMPLE_EVERY: Record<number, number> = { 30: 1, 60: 1, 120: 2 }

// A deliberately irregular arc of soldiers in front of the player (front is -Z), all inside the normal engage range.
function arc(n: number, radius: number, kinds: ('spear' | 'sword' | 'captain')[] = []): Spawn[] {
  const out: Spawn[] = []
  for (let i = 0; i < n; i++) {
    const angle = (i - (n - 1) / 2) * (1.9 / Math.max(1, n - 1)) + 0.017 * (i + 1)
    const r = radius + 0.23 * i
    const kind = kinds[i] === 'captain' ? Kind.Captain : kinds[i] === 'sword' ? Kind.Sword : Kind.Spear
    out.push({ x: S.x + Math.sin(angle) * r, z: S.z - Math.cos(angle) * r, yaw: 0, kind })
  }
  return out
}

export const CROWD_SCENARIOS: CrowdScenario[] = [
  // Engagement, rings and tokens: six soldiers close in, circle, and strike an idle player (all four difficulties).
  ...(['beginner', 'normal', 'hard', 'chaos'] as const).map((difficulty): CrowdScenario => ({
    id: `six_idle_${difficulty}`, duration: 4.0, difficulty, spawns: arc(6, 9, ['spear', 'sword', 'captain', 'spear', 'sword', 'spear']),
  })),
  // Guarding: strikes are parried or blocked; the captain's heavy blow goes through the guard harder.
  { id: 'six_guard_normal', duration: 4.0, difficulty: 'normal', spawns: arc(6, 7, ['spear', 'captain', 'spear', 'sword', 'spear', 'sword']), holds: [{ from: 0.5, to: 4.0, guard: true }] },
  // Fighting back: a normal string into the approaching group; flinched soldiers drop their tokens, kills raise KO.
  { id: 'six_attack_normal', duration: 4.0, difficulty: 'normal', spawns: arc(6, 6), presses: [[1.2, 'attack'], [1.45, 'attack'], [1.7, 'attack'], [1.95, 'attack'], [2.3, 'attack'], [2.6, 'attack']] },
  // Marching in: eighteen soldiers outside the engage range; the closest march until at least twenty are engaged.
  { id: 'eighteen_march_normal', duration: 4.0, difficulty: 'normal', spawns: [...arc(6, 8), ...arc(12, 30, ['spear', 'spear', 'captain'])] },
  // Twenty-four on rings: more than two rings of nine, tokens capped by the difficulty (chaos: 6).
  { id: 'twentyfour_rings_chaos', duration: 3.0, difficulty: 'chaos', spawns: [...arc(12, 5), ...arc(12, 11, ['captain'])] },
  // Moving player: walking through the group makes the rings re-form.
  { id: 'six_walk_hard', duration: 3.0, difficulty: 'hard', spawns: arc(6, 5), holds: [{ from: 0.2, to: 2.6, move: [0.4, 1] }] },
  // The castle: 300 soldiers in 25 squads, per-second summary only.
  { id: 'castle_normal_idle', duration: 6.0, difficulty: 'normal', spawns: squadSpawns(SQUADS, createRng(7)), summary: true, rates: [60] },
  { id: 'castle_chaos_idle', duration: 6.0, difficulty: 'chaos', spawns: squadSpawns(SQUADS, createRng(7)), summary: true, rates: [60] },
]

const r = (v: number) => (Object.is(v, -0) ? 0 : v)
const r6 = (v: number) => r(Math.round(v * 1e6) / 1e6)
const WINDOW_KEYS = new Map((Object.keys(MOVES) as MoveId[]).flatMap((id) => MOVES[id].hits.map((w, i) => [w, `${id}:${i}`] as const)))
const frameOf = (t: number, hz: number) => Math.max(0, Math.ceil(t * hz - 1e-9))
const PHASE_IDS = ['opening', 'pressure', 'surge', 'finale']

interface StoreInternals {
  count: number; alive: Uint8Array; state: Uint8Array; hp: Float32Array; x: Float32Array; y: Float32Array; z: Float32Array
  vx: Float32Array; vy: Float32Array; vz: Float32Array; yaw: Float32Array; spin: Float32Array; spinVel: Float32Array; flash: Float32Array
  stateTime: Float32Array; cooldown: Float32Array; ring: Float32Array; engaged: Uint8Array; token: Uint8Array; attackerCount: number
}

function battleFor(s: CrowdScenario): Battle {
  const b = new Battle({
    arena: new Arena(PLAY_LIMIT, obstacles()),
    spawns: () => s.spawns.map((x) => ({ ...x })),
    playerStart: { x: S.x, z: S.z, facing: S.facing },
    capacity: s.spawns.length,
  })
  b.reset(s.difficulty)
  return b
}

export function runCrowdScenario(s: CrowdScenario, hz: number) {
  const dt = 1 / hz
  const battle = battleFor(s)
  const store = (battle as unknown as { soldiers: StoreInternals }).soldiers
  // Battle's PlayerView hides the active windows and the invulnerability timer; read the Player underneath.
  const zhaoYun = (battle as unknown as { zhaoYun: Player }).zhaoYun
  const labels = new Map<number, string>()
  const label = (stamp: number) => {
    if (!labels.has(stamp)) labels.set(stamp, `P${labels.size + 1}`)
    return labels.get(stamp)!
  }
  const frames: Record<string, unknown>[] = []
  const summaries: Record<string, unknown>[] = []
  const steps = Math.round(s.duration * hz)
  const every = CROWD_SAMPLE_EVERY[hz]
  for (let frame = 0; frame < steps; frame++) {
    const t = frame * dt
    const c: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
    for (const h of s.holds ?? []) {
      if (t + 1e-9 < h.from || t + 1e-9 >= h.to) continue
      if (h.guard) c.guard = true
      if (h.move) { c.moveX = h.move[0]; c.moveZ = h.move[1] }
    }
    for (const [at, button] of s.presses ?? []) if (frameOf(at, hz) === frame) c[button] = true
    battle.step(dt, c)
    const events: unknown[][] = []
    for (const e of battle.events as BattleEvent[]) {
      switch (e.type) {
        case 'hit': {
          const stamp = zhaoYun.activeHits.find((h) => h.window === e.window)?.stamp ?? -1
          const hits = []
          for (let i = e.start; i < e.start + e.count; i++) {
            const h = battle.hits[i]
            hits.push([h.id, h.killed ? 1 : 0, store.hp[h.id], r6(h.x), r6(h.y), r6(h.z), r6(h.dirX), r6(h.dirZ)])
          }
          events.push(['hit', `${label(stamp)}=${WINDOW_KEYS.get(e.window)}`, ...hits])
          break
        }
        case 'kill': {
          const kills = []
          for (let i = e.start; i < e.start + e.count; i++) {
            const k = battle.kills[i]
            kills.push([k.id, r6(k.x), r6(k.y), r6(k.z), r6(k.vx), r6(k.vy), r6(k.vz), r6(k.yaw), r6(k.spin), k.kind])
          }
          events.push(['kill', ...kills])
          break
        }
        case 'enemyStrike': events.push(['enemyStrike', r6(e.x), r6(e.z), e.heavy ? 1 : 0]); break
        case 'parry': events.push(['parry', r6(e.x), r6(e.z), r6(e.facing)]); break
        case 'guardBlock': events.push(['guardBlock', r6(e.x), r6(e.z), r6(e.facing), e.heavy ? 1 : 0, r6(e.damage)]); break
        case 'hurt': events.push(['hurt', r6(e.x), r6(e.z), e.heavy ? 1 : 0]); break
        case 'phase': events.push(['phase', PHASE_IDS.indexOf(e.id)]); break
        default: break // player-side, combo and outcome events are not part of E08
      }
    }
    const p = battle.player
    if (s.summary) {
      if ((frame + 1) % hz !== 0 && frame !== steps - 1 && events.length === 0) continue
      const states = new Array<number>(12).fill(0)
      let engaged = 0, tokens = 0
      for (let i = 0; i < store.count; i++) {
        if (store.alive[i] === 0) continue
        states[store.state[i]]++
        if (store.engaged[i] === 1) engaged++
        if (store.token[i] === 1) tokens++
      }
      summaries.push({
        f: frame, alive: battle.enemies.aliveCount, engaged, tokens, attackers: store.attackerCount, ko: battle.ko, states,
        s: [p.state, p.move?.id ?? '', r6(p.pos.x), r6(p.pos.z), r6(p.facing), r6(p.hp)], hs: r6(battle.hitstop),
        ...(events.length ? { e: events } : {}),
      })
      continue
    }
    if (frame % every !== 0 && events.length === 0) continue
    const soldiers = []
    for (let i = 0; i < store.count; i++) {
      soldiers.push([store.state[i], store.alive[i], store.hp[i], r6(store.x[i]), r6(store.y[i]), r6(store.z[i]), r6(store.vx[i]), r6(store.vy[i]), r6(store.vz[i]),
        r6(store.yaw[i]), r6(store.spin[i]), store.spinVel[i], r6(store.flash[i]), r6(store.stateTime[i]), store.engaged[i], store.token[i], r6(store.ring[i]), r6(store.cooldown[i])])
    }
    frames.push({
      f: frame,
      c: [c.moveX, c.moveZ, c.attack, c.charge, c.jump, c.dodge, c.musou, c.guard === true].map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
      s: [p.state, p.move?.id ?? '', r6(p.moveTime), r6(p.pos.x), r6(p.pos.y), r6(p.pos.z), r6(p.facing), r6(p.musou), r6(p.hp), r6(zhaoYun.invuln)],
      hs: r6(battle.hitstop),
      attackers: store.attackerCount,
      ko: battle.ko,
      ...(events.length ? { e: events } : {}),
      n: soldiers,
    })
  }
  return {
    id: s.id, hz, duration: s.duration, difficulty: s.difficulty, sampleEvery: every, summary: s.summary === true,
    spawns: s.spawns.map((x) => [x.x, x.z, x.yaw, x.kind]), holds: s.holds ?? [], presses: s.presses ?? [],
    ...(s.summary ? { summaries } : { frames }),
  }
}

export function buildCrowdFixture(root: URL) {
  const sources = Object.fromEntries(CROWD_PARITY_SOURCES.map((file) => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]))
  return {
    schemaVersion: 1,
    note: 'Generated by scripts/combat-parity.mjs from the Web source. Do not edit by hand.',
    sources,
    difficulties: Object.fromEntries(Object.values(DIFFICULTIES).map((d) => [d.id, [d.enemyDamage, d.windup, d.captainHp, d.maxAttackers, d.engageRange]])),
    stateFields: ['state', 'move', 'moveTime', 'x', 'y', 'z', 'facing', 'musou', 'hp', 'invuln'],
    soldierFields: ['state', 'alive', 'hp', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'spin', 'spinVel', 'flash', 'stateTime', 'engaged', 'token', 'ring', 'cooldown'],
    summaryFields: ['f', 'alive', 'engaged', 'tokens', 'attackers', 'ko', 'states[12]', 's: state move x z facing hp', 'hs'],
    scenarios: CROWD_SCENARIOS.flatMap((s) => (s.rates ?? [...CROWD_RATES]).map((hz) => runCrowdScenario(s, hz))),
  }
}
