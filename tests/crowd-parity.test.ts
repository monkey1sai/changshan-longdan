import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CROWD_RATES, CROWD_SCENARIOS, buildCrowdFixture } from '../scripts/lib/crowd-parity.ts'

const root = new URL('../', import.meta.url)
const committed = readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-crowd.json', root), 'utf8')

type Frame = { f: number; s: (string | number)[]; attackers: number; ko: number; e?: unknown[][]; n: number[][] }
type Summary = { f: number; alive: number; engaged: number; tokens: number; attackers: number; ko: number; states: number[]; e?: unknown[][] }
interface Scenario { id: string; hz: number; difficulty: string; summary: boolean; frames?: Frame[]; summaries?: Summary[] }

const STATE = { idle: 0, march: 1, engage: 2, windup: 3, strike: 4, recover: 5, flinch: 6, dead: 11 } as const
const MAX_ATTACKERS = { beginner: 2, normal: 4, hard: 5, chaos: 6 } as const

describe('Web-to-Unity crowd parity fixture', () => {
  const text = `${JSON.stringify(buildCrowdFixture(root))}\n`
  const fresh = JSON.parse(text) as { scenarios: Scenario[] }
  const at = (hz: number) => fresh.scenarios.filter((s) => s.hz === hz)
  const states = (s: Scenario) => new Set(s.frames!.flatMap((f) => f.n.map((n) => n[0])))
  const events = (s: Scenario) => s.frames!.flatMap((f) => f.e ?? []).map((e) => e[0] as string)

  it('matches the committed fixture byte for byte after regeneration', () => {
    expect(committed === text, 'web-crowd.json is stale; run npm run parity:write').toBe(true)
  })

  // Guards the E08 acceptance set: every scenario at every rate, the castle at 60 Hz, and the behaviours each exists for.
  it('keeps every scenario and reaches the AI states it exists for', () => {
    for (const hz of CROWD_RATES) {
      expect(at(hz).map((s) => s.id), `${hz} Hz`).toEqual(CROWD_SCENARIOS.filter((s) => (s.rates ?? [...CROWD_RATES]).includes(hz)).map((s) => s.id))
    }
    const byId = Object.fromEntries(at(60).map((s) => [s.id, s]))
    for (const d of ['beginner', 'normal', 'hard', 'chaos'] as const) {
      const s = byId[`six_idle_${d}`]
      expect([...states(s)].sort(), d).toEqual([STATE.engage, STATE.windup, STATE.strike, STATE.recover])
      expect(events(s), d).toContain('hurt')
      expect(Math.max(...s.frames!.map((f) => f.attackers)), `${d} attackers`).toBeLessThanOrEqual(MAX_ATTACKERS[d])
    }
    expect(events(byId.six_guard_normal)).toContain('guardBlock')
    expect(events(byId.six_attack_normal)).toContain('kill')
    expect(states(byId.six_attack_normal)).toContain(STATE.flinch)
    expect(states(byId.eighteen_march_normal)).toContain(STATE.march)
    expect(Math.max(...byId.twentyfour_rings_chaos.frames!.map((f) => f.attackers))).toBe(6)
    for (const id of ['castle_normal_idle', 'castle_chaos_idle']) {
      const s = byId[id]
      expect(s.summary).toBe(true)
      const last = s.summaries!.at(-1)!
      expect(last.alive).toBe(300)
      expect(last.engaged).toBeLessThanOrEqual(54)
      expect(last.attackers).toBeLessThanOrEqual(id.includes('chaos') ? 6 : 4)
      expect(last.states.reduce((a, b) => a + b, 0)).toBe(300)
    }
  })
})
