import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import { MOVES, type MoveId } from '../../src/combat/moves.ts'
import { createRng } from '../../src/core/math.ts'
import { Arena } from '../../src/entities/arena.ts'
import { Battle, type BattleEvent } from '../../src/entities/battle.ts'
import { Kind, type Spawn } from '../../src/entities/enemies.ts'
import { MUSOU_MAX, type PlayerControls } from '../../src/entities/player.ts'
import { Dust } from '../../src/fx/dust.ts'
import { Fragments } from '../../src/fx/fragments.ts'
import { Shockwaves } from '../../src/fx/shockwave.ts'
import { Sparks } from '../../src/fx/sparks.ts'
import { Trail } from '../../src/fx/trail.ts'
import { Presentation, type AudioSink, type PresentationSinks } from '../../src/presentation.ts'
import { SOLDIER_COLORS } from '../../src/view/soldier-view.ts'
import { PLAY_LIMIT, PLAYER_START, obstacles } from '../../src/world/layout.ts'

// E07 feedback reference data: the unmodified Web Battle produces events, the unmodified Presentation turns the part
// E07 ports into sink calls, and the unmodified particle classes (sparks, dust, shockwaves, fragments) simulate them with
// the game's shared createRng(99), in game.ts's order (step, play, then each effect's update with the game-time step).
// Out of scope and filtered before play: the musou dragon (dragonHit, dragonFrame), combo, milestones, battle phases and
// the outcome. Audio, HUD and post-processing are recorded as calls only. A fixed camera gives the sound pan.

export const PRESENTATION_PARITY_SOURCES = [
  'src/presentation.ts', 'src/fx/sparks.ts', 'src/fx/dust.ts', 'src/fx/shockwave.ts', 'src/fx/fragments.ts', 'src/fx/trail.ts',
  'src/view/soldier-view.ts', 'src/entities/battle.ts', 'src/core/math.ts', 'scripts/lib/presentation-parity.ts',
] as const

const PORTED = new Set<BattleEvent['type']>(['swing', 'jump', 'land', 'dodge', 'musouStart', 'fx', 'hit', 'kill', 'enemyStrike', 'parry',
  'guardBlock', 'hurt', 'musouReady'])
const AUDIO: (keyof AudioSink)[] = ['swing', 'jump', 'land', 'dodge', 'hit', 'shatter', 'enemySwing', 'playerHurt', 'musouStart',
  'dragonRoar', 'musouBlast', 'musouReady', 'milestone', 'victory', 'defeat', 'setMusicLevel']

type Button = 'attack' | 'charge' | 'jump' | 'dodge' | 'musou'
type Press = [Button, number] // pressed on the first frame at or after this time
type Strike = { at: number; damage: number; heavy: boolean; dx: number; dz: number } // relative to the player
interface Scenario {
  id: string
  duration: number
  rates: number[]
  spawns: Spawn[]
  presses?: Press[]
  guard?: [number, number]
  move?: [number, number, number, number] // from, to, moveX, moveZ
  strikes?: Strike[]
  musou?: number
  expectMoves: MoveId[]
}

const S = PLAYER_START
const ahead = (d: number, side: number, kind: Kind = Kind.Spear): Spawn => ({
  x: S.x + Math.sin(S.facing) * d + Math.cos(S.facing) * side, z: S.z + Math.cos(S.facing) * d - Math.sin(S.facing) * side, yaw: S.facing + Math.PI, kind,
})
const front = (n: number, captainAt = -1): Spawn[] =>
  Array.from({ length: n }, (_, i) => ahead(1.6 + (i % 3) * 0.45 + 0.013 * i, (i - (n - 1) / 2) * 0.55, i === captainAt ? Kind.Captain : Kind.Spear))
const FAR: Spawn[] = [{ x: 60, z: 60, yaw: 0, kind: Kind.Captain }]
const every = (button: Button, from: number, step: number, n: number): Press[] => Array.from({ length: n }, (_, i) => [button, from + i * step])

export const PRESENTATION_SCENARIOS: Scenario[] = [
  // N1-N6 into a crowd with a captain: light, pierce and heavy hits, swings, kills (soldier and captain fragments).
  { id: 'string_crowd', duration: 4.2, rates: [30, 60, 120], spawns: front(6, 2), presses: every('attack', 0.05, 0.28, 6), expectMoves: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'] },
  // Charge branches into a wider crowd: launches, heavy hits on more than three at once, the C5 shockwave.
  {
    id: 'charge_crowd', duration: 4.6, rates: [30, 60], spawns: front(12, 5),
    presses: [['attack', 0.05], ['charge', 0.3], ['attack', 1.5], ['attack', 1.75], ['attack', 2.0], ['attack', 2.25], ['charge', 2.5]],
    expectMoves: ['N1', 'C2', 'N1', 'N2', 'N3', 'N4', 'C5'],
  },
  // Air and ground mobility: jump, JA's shockwave and heavy landing, JC, dodge and DASH.
  {
    id: 'air_dodge', duration: 4.4, rates: [30, 60], spawns: front(5),
    presses: [['jump', 0.05], ['attack', 0.3], ['jump', 1.5], ['charge', 1.75], ['dodge', 2.8], ['dodge', 3.4], ['attack', 3.5]],
    expectMoves: ['JA', 'JC', 'DASH'],
  },
  // Musou: ready banner, start (cutin, music duck), swings, heavy hits, the closing blast and the music returning.
  { id: 'musou_crowd', duration: 6.0, rates: [30, 60, 120], spawns: front(8, 3), musou: MUSOU_MAX, presses: [['musou', 0.3]], expectMoves: ['MUSOU'] },
  // Strikes on the player: a perfect guard, a block (heavy, damage through the guard), a light and a heavy hurt.
  {
    id: 'guard_and_hurt', duration: 3.6, rates: [30, 60], spawns: FAR, guard: [0.1, 1.4],
    strikes: [{ at: 0.15, damage: 26, heavy: false, dx: 0.3, dz: -2 }, { at: 1.0, damage: 70, heavy: true, dx: -1.2, dz: -1.5 },
      { at: 1.8, damage: 26, heavy: false, dx: 1.5, dz: 1 }, { at: 2.4, damage: 70, heavy: true, dx: -0.4, dz: 2 }],
    expectMoves: [],
  },
]

/** The listener for the pan: a fixed camera behind and above the start, its right vector off the world axes. */
export const PARITY_CAMERA = { x: S.x - 3.1, y: 5.4, z: S.z + 8.3, rightX: 0.8, rightZ: -0.6 }

const WINDOW_KEYS = new Map((Object.keys(MOVES) as MoveId[]).flatMap((id) => MOVES[id].hits.map((w, i) => [w, `${id}:${i}`] as const)))
const r5 = (v: number) => {
  const x = Math.round(v * 1e5) / 1e5
  return Object.is(x, -0) ? 0 : x
}
const frameOf = (t: number, hz: number) => Math.max(0, Math.ceil(t * hz - 1e-9))

function serializeEvent(e: BattleEvent): unknown[] {
  switch (e.type) {
    case 'swing':
    case 'land':
      return [e.type, e.heavy ? 1 : 0]
    case 'fx':
      return [e.type, e.fx, e.x, e.z, e.radius]
    case 'hit': {
      const key = WINDOW_KEYS.get(e.window)
      if (key === undefined) throw new Error('hit from a window outside MOVES')
      return [e.type, key, e.start, e.count]
    }
    case 'kill':
      return [e.type, e.start, e.count]
    case 'enemyStrike':
    case 'hurt':
      return [e.type, e.x, e.z, e.heavy ? 1 : 0]
    case 'parry':
      return [e.type, e.x, e.z, e.facing]
    case 'guardBlock':
      return [e.type, e.x, e.z, e.facing, e.heavy ? 1 : 0, e.damage]
    default:
      return [e.type]
  }
}

interface Internal<T> { [key: string]: T }
const priv = (o: object) => o as unknown as Internal<Float32Array> & Internal<number> & Internal<unknown[]>

/** Sums that catch a diverging particle within a frame; full states are sampled sparsely. */
function digest(sparks: Sparks, dust: Dust, fragments: Fragments, waves: Shockwaves) {
  const sp = priv(sparks), du = priv(dust), fr = priv(fragments)
  const sum = (a: Float32Array, n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += a[i]
    return r5(s)
  }
  const effects = [...(priv(waves).rings as unknown as { active: boolean; t: number; mesh: { scale: Vector3 } }[]),
    ...(priv(waves).pillars as unknown as { active: boolean; t: number; mesh: { scale: Vector3 } }[])]
  return {
    n: [sp.count as unknown as number, du.count as unknown as number, fragments.active, effects.filter((e) => e.active).length],
    sum: [sum(sp.pos as Float32Array, (sp.count as unknown as number) * 3), sum(sp.color as Float32Array, (sp.count as unknown as number) * 4),
      sum(du.pos as Float32Array, (du.count as unknown as number) * 3), sum(du.size as Float32Array, du.count as unknown as number),
      sum(fr.p as Float32Array, fragments.active * 3), sum(fr.r as Float32Array, fragments.active * 3)],
    waves: effects.map((e) => (e.active ? [r5(e.t), r5(e.mesh.scale.x), r5(e.mesh.scale.y)] : 0)),
  }
}

function sample(sparks: Sparks, dust: Dust, fragments: Fragments) {
  const sp = priv(sparks), du = priv(dust), fr = priv(fragments)
  const take = (a: Float32Array, n: number) => Array.from(a.subarray(0, n), r5)
  const ns = sp.count as unknown as number, nd = du.count as unknown as number, nf = fragments.active
  return {
    sparks: { pos: take(sp.pos as Float32Array, ns * 3), vel: take(sp.vel as Float32Array, ns * 3), color: take(sp.color as Float32Array, ns * 4), size: take(sp.size as Float32Array, ns), life: take(sp.life as Float32Array, ns) },
    dust: { pos: take(du.pos as Float32Array, nd * 3), size: take(du.size as Float32Array, nd), alpha: take(du.alpha as Float32Array, nd) },
    fragments: { p: take(fr.p as Float32Array, nf * 3), r: take(fr.r as Float32Array, nf * 3), size: take(fr.size as Float32Array, nf), life: take(fr.life as Float32Array, nf), color: take(fr.colors as Float32Array, nf * 3) },
  }
}

export function runPresentationScenario(s: Scenario, hz: number) {
  const dt = 1 / hz
  const battle = new Battle({ arena: new Arena(PLAY_LIMIT, obstacles()), spawns: () => s.spawns, playerStart: { x: S.x, z: S.z, facing: S.facing }, capacity: s.spawns.length })
  if (s.musou) battle.debug.setMusou(s.musou)
  const base = createRng(99)
  let draws = 0
  const rng = () => {
    draws++
    return base()
  }
  const calls: unknown[][] = []
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args.filter((a) => typeof a !== 'function').map((a) => (typeof a === 'boolean' ? (a ? 1 : 0) : a))])
  }
  const sparks = new Sparks()
  const dust = new Dust()
  const waves = new Shockwaves()
  const fragments = new Fragments()
  const post = {
    get aberration() { return 0 }, set aberration(v: number) { calls.push(['post.aberration', v]) },
    get radial() { return 0 }, set radial(v: number) { calls.push(['post.radial', v]) },
    get flash() { return 0 }, set flash(v: number) { calls.push(['post.flash', v]) },
  }
  const sinks: PresentationSinks = {
    audio: () => Object.fromEntries(AUDIO.map((k) => [k, rec(`audio.${String(k)}`)])) as unknown as AudioSink,
    sparks: {
      burst: (...a: Parameters<Sparks['burst']>) => { rec('sparks.burst')(...a); sparks.burst(...a) },
      glitter: (...a: Parameters<Sparks['glitter']>) => { rec('sparks.glitter')(...a); sparks.glitter(...a) },
    },
    dust: {
      puff: (...a: Parameters<Dust['puff']>) => { rec('dust.puff')(...a); dust.puff(...a) },
      ring: (...a: Parameters<Dust['ring']>) => { rec('dust.ring')(...a); dust.ring(...a) },
    },
    waves: {
      ring: (x, z, radius, duration, color) => { calls.push(['waves.ring', x, z, radius, duration, color.r, color.g, color.b]); waves.ring(x, z, radius, duration, color) },
      pillar: (x, z, radius, height, duration, color) => { calls.push(['waves.pillar', x, z, radius, height, duration, color.r, color.g, color.b]); waves.pillar(x, z, radius, height, duration, color) },
    },
    fragments: { spawnSoldier: (k, r) => { calls.push(['fragments.spawnSoldier', k.id]); fragments.spawnSoldier(k, r) } },
    camera: {
      addTrauma: rec('camera.addTrauma'), kick: rec('camera.kick'),
      right: new Vector3(PARITY_CAMERA.rightX, 0, PARITY_CAMERA.rightZ), camera: { position: new Vector3(PARITY_CAMERA.x, PARITY_CAMERA.y, PARITY_CAMERA.z) },
    },
    post: post as PresentationSinks['post'],
    hud: { showBanner: (_text, seconds, style) => calls.push(['hud.showBanner', seconds, style ?? '']), playCutin: rec('hud.playCutin') },
    dragon: { randomPoint: () => { throw new Error('the dragon is out of E07 scope') } },
    rng,
  }
  const presentation = new Presentation(sinks)
  const started: MoveId[] = []
  const frames = []
  const presses = [...(s.presses ?? [])]
  let next = 0
  for (let frame = 0; frame < Math.round(s.duration * hz); frame++) {
    const t = frame * dt
    const c: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
    if (s.guard && t + 1e-9 >= s.guard[0] && t + 1e-9 < s.guard[1]) c.guard = true
    if (s.move && t + 1e-9 >= s.move[0] && t + 1e-9 < s.move[1]) { c.moveX = s.move[2]; c.moveZ = s.move[3] }
    while (next < presses.length && frameOf(presses[next][1], hz) <= frame) c[presses[next++][0]] = true
    calls.length = 0
    draws = 0
    const simDt = battle.step(dt, c)
    const events: unknown[][] = []
    const hits: number[][] = []
    const kills: number[][] = []
    const play = () => {
      const ported = battle.events.filter((e) => PORTED.has(e.type))
      for (const e of battle.events) if (e.type === 'moveStart') started.push(e.moveId)
      if (ported.length === 0) return
      // Indices refer to this frame's buffers as recorded below (an injected strike's events have none).
      const hitBase = hits.length, killBase = kills.length
      if (ported.some((e) => e.type === 'hit')) for (const h of battle.hits) hits.push([h.x, h.y, h.z, h.dirX, h.dirZ])
      if (ported.some((e) => e.type === 'kill')) for (const k of battle.kills) kills.push([k.id, k.x, k.y, k.z, k.vx, k.vy, k.vz, k.yaw, k.kind])
      for (const e of ported) {
        const out = serializeEvent(e)
        if (e.type === 'hit') out[2] = (out[2] as number) + hitBase
        if (e.type === 'kill') out[1] = (out[1] as number) + killBase
        events.push(out)
      }
      presentation.play(ported, battle)
    }
    play()
    for (const st of s.strikes ?? []) {
      if (frameOf(st.at, hz) !== frame) continue
      const p = battle.player.pos
      battle.debug.injectStrike({ damage: st.damage, heavy: st.heavy, x: p.x + st.dx, z: p.z + st.dz })
      play()
    }
    presentation.musouState(battle.player.state === 'musou', true)
    fragments.update(simDt)
    sparks.update(simDt)
    dust.update(simDt, 500)
    waves.update(simDt)
    const p = battle.player
    frames.push({
      f: frame,
      dt: simDt,
      p: [p.pos.x, p.pos.y, p.pos.z, p.facing, p.state === 'musou' ? 1 : 0],
      ...(events.length ? { e: events, h: hits, k: kills } : {}),
      ...(calls.length ? { c: calls.map((call) => [...call]) } : {}),
      r: draws,
      ...digest(sparks, dust, fragments, waves),
      ...(frame % Math.round(hz / 2) === 0 ? { full: sample(sparks, dust, fragments) } : {}),
    })
  }
  if (started.join(',') !== s.expectMoves.join(',')) throw new Error(`${s.id}@${hz}: started ${started.join(',')}, expected ${s.expectMoves.join(',')}`)
  if (next !== presses.length) throw new Error(`${s.id}@${hz}: only ${next} of ${presses.length} presses happened`)
  return { id: s.id, hz, frames }
}

// Trail: the spear's two trail points sweep an arc (fast enough for the Catmull-Rom fill), pause, sweep back in musou
// style; positions and fades are recorded every frame.
export const TRAIL_RATES = [30, 60, 120] as const
export function runTrailScenario(hz: number) {
  const trail = new Trail()
  const t = priv(trail)
  const frames = []
  const base = new Vector3()
  const tip = new Vector3()
  for (let frame = 0; frame < Math.round(1.1 * hz); frame++) {
    const time = frame / hz
    const musou = time >= 0.5
    const active = time < 0.3 || (time >= 0.5 && time < 0.75)
    const a = musou ? 2.6 - (time - 0.5) * 9 : -1.2 + time * 11
    base.set(Math.sin(a) * 1.25, 1.1 + 0.2 * Math.sin(time * 7), Math.cos(a) * 1.25)
    tip.set(Math.sin(a) * 2.7, 1.2 + 0.4 * Math.sin(time * 7), Math.cos(a) * 2.7)
    trail.setStyle(musou)
    if (active) trail.push(base, tip, time)
    trail.update(time)
    const n = t.n as unknown as number
    frames.push({
      f: frame, time, musou: musou ? 1 : 0, active: active ? 1 : 0, base: [base.x, base.y, base.z], tip: [tip.x, tip.y, tip.z], n,
      positions: Array.from((t.positions as Float32Array).subarray(0, n * 6), r5), fade: Array.from((t.fade as Float32Array).subarray(0, n * 2), r5),
    })
  }
  return { hz, frames }
}

export function buildPresentationFixture(root: URL) {
  const sources = Object.fromEntries(PRESENTATION_PARITY_SOURCES.map((file) => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]))
  const palette = Object.fromEntries(Object.entries(SOLDIER_COLORS).map(([k, c]) => [k, [c.r, c.g, c.b]]))
  return {
    schemaVersion: 1,
    note: 'Generated by scripts/combat-parity.mjs from the Web source. Do not edit by hand.',
    sources,
    camera: PARITY_CAMERA,
    playLimit: PLAY_LIMIT,
    palette,
    hitFields: ['x', 'y', 'z', 'dirX', 'dirZ'],
    killFields: ['id', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'kind'],
    digestFields: { n: ['sparks', 'dust', 'fragments', 'activeWaves'], sum: ['sparkPos', 'sparkColor', 'dustPos', 'dustSize', 'fragmentPos', 'fragmentRot'], waves: 'rings[10] then pillars[3]: 0 or [t, scaleX, scaleY]' },
    scenarios: PRESENTATION_SCENARIOS.flatMap((s) => s.rates.map((hz) => runPresentationScenario(s, hz))),
    trail: TRAIL_RATES.map((hz) => runTrailScenario(hz)),
  }
}
