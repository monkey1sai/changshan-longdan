import { describe, expect, it } from 'vitest'
import { BASELINE_SCENARIOS, runScenario } from '../scripts/lib/baseline-harness.ts'
import { readEffectiveProfile, readNumericConstant, readRepeatAssignments, readRepeatRules } from '../scripts/lib/baseline-profile.ts'

const rates = [30, 60, 120] as const
const moves = (trace: ReturnType<typeof runScenario>) => trace.frames.flatMap(frame =>
  frame.events.filter(event => event.type === 'moveStart').map(event => event.moveId))

describe('E01 baseline traces using production gameplay methods', () => {
  for (const hz of rates) {
    it(`${hz}Hz consumes an early buffered normal attack`, () => {
      const trace = runScenario(BASELINE_SCENARIOS.early_combo, hz)
      expect(moves(trace)).toContain('N2')
      expect(trace.frames.some(frame => frame.rawEvents.some(event => event.at === 0.08))).toBe(true)
      for (const frame of trace.frames) {
        for (const event of frame.rawEvents) {
          expect(frame.tickStartSec - event.at).toBeGreaterThanOrEqual(-1e-9)
          expect(frame.tickStartSec - event.at).toBeLessThanOrEqual(1 / hz + 1e-9)
        }
      }
    })

    it(`${hz}Hz queues charge during real hitstop and records no stale events`, () => {
      const trace = runScenario(BASELINE_SCENARIOS.hitstop_input, hz)
      const chargeFrame = trace.frames.find(frame => frame.input.charge)
      expect(chargeFrame?.before.hitstop).toBeGreaterThan(0)
      expect(chargeFrame?.after.simClock).toBe(chargeFrame?.before.simClock)
      expect(chargeFrame?.events).toEqual([])
      expect(chargeFrame?.hits).toEqual([])
      expect(moves(trace)).toContain('C2')
    })

    for (const id of ['pause_buffer', 'blur_buffer'] as const) {
      it(`${hz}Hz ${id} clears pending charge without advancing the paused simulation clock`, () => {
        const trace = runScenario(BASELINE_SCENARIOS[id], hz)
        expect(trace.frames.some(frame => frame.after.mode === 'paused')).toBe(true)
        expect(moves(trace)).not.toContain('C2')
        const paused = trace.frames.filter(frame => frame.after.mode === 'paused')
        expect(paused.length).toBeGreaterThan(0)
        for (const frame of paused) expect(frame.after.simClock).toBe(frame.before.simClock)
        expect(trace.final.mode).toBe('playing')
      })
    }

    for (const count of [1, 5, 20] as const) {
      it(`${hz}Hz records ${count} accepted targets in the real C4 hit window`, () => {
        const trace = runScenario(BASELINE_SCENARIOS[`hit_${count}`], hz)
        const hits = trace.frames.flatMap(frame => frame.hits)
        expect(new Set(hits.flatMap(hit => hit.targets.map(target => target.id))).size).toBe(count)
        expect(hits.reduce((sum, hit) => sum + hit.targets.length, 0)).toBe(count)
        expect(trace.frames.some(frame => frame.after.hitstop > 0)).toBe(true)
        // A proxy never becomes an asserted rendered/occlusion count.
        expect(trace.final.population.visible).toBeNull()
        expect(trace.final.population.frustumProxy).toBeGreaterThanOrEqual(0)
      })
    }

    it(`${hz}Hz keeps the old hit owner when the same tick starts the next move`, () => {
      const trace = runScenario({ ...BASELINE_SCENARIOS.hit_1, id: 'cancel_hit_owner',
        initialMove: 'N2', initialMoveTime: 0.215, duration: 0.05,
        events: [{ at: 0, type: 'keydown', code: 'KeyJ' }, { at: 0.005, type: 'keyup', code: 'KeyJ' }],
      }, hz)
      const hitFrame = trace.frames.find(frame => frame.hits.length > 0)
      expect(hitFrame?.after.player.move).toBe('N3')
      expect(hitFrame?.hits[0]).toMatchObject({ moveId: 'N2', windowIndex: 0, attackOrdinal: 1 })
    })

    it(`${hz}Hz observation preserves every fixture's production-kernel outcome`, () => {
      for (const scenario of Object.values(BASELINE_SCENARIOS)) {
        const recorded = runScenario(scenario, hz)
        const plain = runScenario(scenario, hz, { observe: false })
        expect(plain.frames).toEqual([])
        expect(recorded.final).toEqual(plain.final)
        expect(recorded.finalEnemyState).toEqual(plain.finalEnemyState)
      }
    })
  }

  it.each([0, 240, NaN, Infinity])('rejects an unsupported sampling rate %s', hz => {
    expect(() => runScenario(BASELINE_SCENARIOS.early_combo, hz)).toThrow(/30.*60.*120/)
  })

  it('rejects unsorted/out-of-range raw events and invalid seed before simulation', () => {
    const scenario = BASELINE_SCENARIOS.early_combo
    expect(() => runScenario({ ...scenario, seed: -1 }, 60)).toThrow(/seed/)
    expect(() => runScenario({ ...scenario, events: [{ at: -0.1, type: 'blur' }] }, 60)).toThrow(/event/)
    expect(() => runScenario({ ...scenario, events: [{ at: 0.2, type: 'blur' }, { at: 0.1, type: 'focus' }] }, 60)).toThrow(/event/)
  })
})

describe('scoped effective profile fails closed on unsupported sources', () => {
  it('reads changed numeric values rather than substituting the original buffer', () => {
    expect(readNumericConstant('const BUFFER = 0.123', 'BUFFER')).toBe(0.123)
  })
  it.each(['', 'const BUFFER = 0.1; const BUFFER = 0.2', 'const BUFFER = Math.max(0.1, 0.2)', 'const BUFFER = 1e999'])('rejects missing, duplicate, unsupported or non-finite declarations', source => {
    expect(() => readNumericConstant(source, 'BUFFER')).toThrow()
  })
  it('requires both inline repeat rules and reads their current source values', () => {
    const source = "class Input { poll() { if (!guard && this.attackRepeat === 0) { this.attackRepeat = 0.19 } if (this.pressed.has('charge')) { this.attackRepeat = 0.49 } } }"
    expect(readRepeatAssignments(source)).toEqual([0.19, 0.49])
    expect(() => readRepeatAssignments('class Input { poll() { this.attackRepeat = 0.19 } }')).toThrow()
  })
  it('preserves repeat semantics when source branches change order and rejects unknown conditions', () => {
    const reversed = "class Input { poll() { if (this.pressed.has('charge')) { this.attackRepeat = 0.49 } if (!guard && this.attackRepeat === 0) { this.attackRepeat = 0.19 } } }"
    expect(readRepeatRules(reversed)).toMatchObject([{ kind: 'chargeSuppression', value: 0.49 }, { kind: 'attackRepeat', value: 0.19 }])
    expect(() => readRepeatRules(reversed.replace('!guard', 'guard'))).toThrow(/condition/)
  })
  it('rejects a different checkout before mixing imported objects with file hashes', () => {
    expect(() => readEffectiveProfile('C:/not-the-runner-checkout')).toThrow(/checkout/)
  })
  it('captures the actual scoped baseline and all 17 move definitions', () => {
    const profile = readEffectiveProfile(process.cwd())
    expect(profile.player.BUFFER).toBe(0.45)
    expect(profile.input).toMatchObject({ attackRepeatSec: 0.18, chargeSuppressRepeatSec: 0.48 })
    expect(Object.keys(profile.moves)).toHaveLength(17)
    expect(profile.candidateProfileConnected).toBe(false)
    expect(profile.sourceHashes['src/game.ts']).toMatch(/^[0-9a-f]{64}$/)
  })
})
