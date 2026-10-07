import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Battle } from '../../src/entities/battle.ts'
import { castleSetup } from '../../src/entities/castle-setup.ts'
import { Kind } from '../../src/entities/enemies.ts'
import { CROWD_PARITY_SOURCES } from './crowd-parity.ts'

// Scripted movement only: PI camera yaw makes W point towards -Z. No teleports, strikes or balance overrides.
export const DIRECTOR_ROUTE = { id: 'castle_walk_normal', hz: 30, duration: 9, seed: 7, resets: 2, cameraYaw: Math.PI,
  holds: [{ from: 0, to: 9, key: 'KeyW' }], injections: [],
  mustVisit: [{ id: 'squad_2', x: 0, z: 24, radius: 6 }, { id: 'squad_7', x: 0, z: 10, radius: 6 }],
  positionTolerance: 1e-4, maxEligibleStuckSeconds: 1,
} as const
export const DIRECTOR_SOURCES = [...CROWD_PARITY_SOURCES, 'scripts/lib/director-parity.ts', 'unity/ChangshanLongdan/Assets/Combat/Runtime/DirectorRoute.cs']
const round = (n: number) => Math.round(n * 1e6) / 1e6
export interface DirectorFrame {
  f: number; alive: number; engaged: number; attackers: number; phase: string; ko: number; x: number; z: number
  hp: number; state: string; simTime: number; stepped: boolean; inputMove: boolean; operationalIdle: boolean
  rawInputNoProgress: boolean; eligibleMove: boolean; eligibleStuck: boolean
}
export function movementDiagnostics(inputMove: boolean, alive: boolean, stepped: boolean, beforeState: string, afterState: string, distance: number) {
  const rawInputNoProgress = inputMove && distance <= 1e-6
  const eligibleMove = inputMove && alive && stepped && beforeState === 'move' && afterState === 'move'
  return { rawInputNoProgress, eligibleMove, eligibleStuck: eligibleMove && rawInputNoProgress }
}
export function runDirectorScenario(castle = true, retry = false) {
  const setup = castleSetup()
  if (!castle) { setup.capacity = 2; setup.spawns = () => [{ x: 0, z: 33, yaw: 0, kind: Kind.Spear }, { x: 3, z: 34, yaw: 0, kind: Kind.Sword }] }
  const battle = new Battle(setup)
  const resetWitness = () => Array.from((battle.enemies as unknown as { cooldown: Float32Array }).cooldown.slice(0, 2))
  const resetWitnesses = [resetWitness()]
  battle.reset('normal') // constructor + explicit reset; enemy RNG continues
  resetWitnesses.push(resetWitness())
  const hz = 30, duration = castle ? DIRECTOR_ROUTE.duration : 2
  const frames: DirectorFrame[] = []
  for (let f = 0; f < duration * hz; f++) {
    if (retry && f === 30) { battle.reset('normal'); resetWitnesses.push(resetWitness()) } // third reset, same EnemyStore rng instance
    const before = battle.player, x = before.pos.x, z = before.pos.z, state = before.state
    const stepped = battle.step(1 / hz, { moveX: Math.sin(Math.PI), moveZ: Math.cos(Math.PI), attack: false, charge: false, jump: false, dodge: false, musou: false }) > 0
    if (retry && f === 29) {
      battle.debug.setHp(1)
      battle.debug.injectStrike({ x: battle.player.pos.x, z: battle.player.pos.z - 1, heavy: true, damage: 70 })
    }
    const p = battle.player
    let engaged = 0
    for (let i = 0; i < battle.enemies.count; i++) if (battle.enemies.alive[i] && battle.enemies.engaged[i]) engaged++
    frames.push({ f, alive: battle.enemies.aliveCount, engaged,
      attackers: (battle.enemies as unknown as { attackerCount: number }).attackerCount, phase: battle.phase, ko: battle.ko,
      x: round(p.pos.x), z: round(p.pos.z), hp: round(p.hp), state: p.state, simTime: round(battle.battleTime), stepped, inputMove: true,
      operationalIdle: p.hp > 0 && battle.enemies.aliveCount > 0 && engaged === 0,
      ...movementDiagnostics(true, p.hp > 0, stepped, state, p.state, Math.hypot(p.pos.x - x, p.pos.z - z)),
    })
  }
  return { id: retry ? 'two_dev_death_retry_normal' : castle ? DIRECTOR_ROUTE.id : 'two_walk_normal', hz, duration, difficulty: 'normal', seed: 7, resets: retry ? 3 : 2,
    injections: retry ? [{ frame: 29, type: 'DEV lethal strike', hp: 1, damage: 70 }, { frame: 30, type: 'retry; RNG continues' }] : [],
    resetWitnesses,
    spawns: setup.spawns().map(s => [s.x, s.z, s.yaw, s.kind]), frames,
    summaries: frames.filter(f => (f.f + 1) % hz === 0),
  }
}
export function buildDirectorFixture(root: URL) {
  return { schemaVersion: 1, note: 'Scripted input diagnostics; no natural-play or tempo-quality claim.', route: DIRECTOR_ROUTE,
    sources: Object.fromEntries(DIRECTOR_SOURCES.map(file => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')])),
    scenarios: [runDirectorScenario(false), runDirectorScenario(true), runDirectorScenario(false, true)],
  }
}
