import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDirectorFixture, DIRECTOR_ROUTE, movementDiagnostics, runDirectorScenario } from '../scripts/lib/director-parity.ts'
describe('E11 scripted director diagnostics', () => {
  it('matches the generated fixture and preserves the two reset contract', () => {
    const root = new URL('../', import.meta.url)
    expect(readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-director.json', root), 'utf8')).toBe(JSON.stringify(buildDirectorFixture(root)) + '\n')
    expect(buildDirectorFixture(root).scenarios.map(s => [s.frames.length, s.summaries.length, s.resets])).toEqual([[60, 2, 2], [270, 9, 2], [60, 2, 3]])
  })
  it('records DEV death and a third reset without recreating or reseeding the battle', () => {
    const s = runDirectorScenario(false, true)
    expect(s.frames[29].hp).toBe(0)
    expect(s.frames[29].state).toBe('dead')
    expect(s.frames[30].hp).toBeGreaterThan(0)
    expect(s.frames[30].simTime).toBeCloseTo(1 / 30, 6)
    expect(s.resets).toBe(3)
    expect(s.resetWitnesses).toHaveLength(3)
    expect(s.resetWitnesses[2]).not.toEqual(s.resetWitnesses[0])
    expect(s.resetWitnesses[2]).not.toEqual(s.resetWitnesses[1])
    expect(s.injections).toHaveLength(2)
  })
  it('walks into multiple squad regions with no injected damage or natural KO claim', () => {
    const s = runDirectorScenario()
    for (const target of DIRECTOR_ROUTE.mustVisit) expect(s.frames.some(f => Math.hypot(f.x - target.x, f.z - target.z) <= target.radius), target.id).toBe(true)
    expect(s.frames.every(f => f.ko === 0 && f.phase === 'opening')).toBe(true)
    expect(s.frames.filter(f => f.eligibleStuck).length / 30).toBeLessThanOrEqual(1)
  })
  it.each(['dead', 'hurt', 'attack', 'down'])('does not label %s as collision stuck', state => {
    expect(movementDiagnostics(true, state !== 'dead', true, state, state, 0)).toEqual({ rawInputNoProgress: true, eligibleMove: false, eligibleStuck: false })
  })
  it('separates hit-stop, zero input, boundary progress and eligible stuck', () => {
    expect(movementDiagnostics(true, true, false, 'move', 'move', 0).eligibleStuck).toBe(false)
    expect(movementDiagnostics(false, true, true, 'move', 'move', 0).rawInputNoProgress).toBe(false)
    expect(movementDiagnostics(true, true, true, 'move', 'move', 1e-6).eligibleStuck).toBe(true)
    expect(movementDiagnostics(true, true, true, 'move', 'move', 2e-6).eligibleStuck).toBe(false)
  })
})
