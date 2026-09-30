import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const harness = fileURLToPath(new URL('./helpers/player-runner-harness.mjs', import.meta.url))
const playing = {
  documentId: 0, mode: 'playing', focused: true, controls: [], text: 'WASD J K F Esc L',
  ko: 0, remaining: 300, hpRatio: 1, musouReady: false, moveName: '', moveHint: '', resultText: '',
  map: { player: { x: 80, y: 80 }, targets: [{ x: 80, y: 85 }] },
}
const victory = {
  ...playing, mode: 'victory', ko: 300, remaining: null, resultText: 'KOs 300',
  controls: [{ id: 'retry', name: '再戰' }],
}
const win = {
  id: 'victory', goal: 'Win', allowed: ['attack'],
  until: [{ field: 'mode', op: 'eq', value: 'victory' }, { field: 'ko', op: 'eq', value: 300 }],
}
const retry = {
  id: 'retry', goal: 'Click visible retry to begin again', allowed: ['click_retry'],
  until: [{ field: 'mode', op: 'eq', value: 'playing' }, { field: 'ko', op: 'eq', value: 0 }],
}
function run(overrides = {}) {
  const fixture = {
    initial: playing, actions: [{ id: 'attack', after: victory }],
    ...overrides,
    scenario: {
      id: 'runner-regression', goal: 'Verify configured player stages',
      maxSteps: 10, maxDurationMs: 5000, noProgressMs: 90000, confidenceThreshold: 0.6, stages: [win],
      ...overrides.scenario,
    },
  }
  const output = execFileSync(process.execPath,
    ['--experimental-strip-types', '--experimental-vm-modules', harness], {
      input: JSON.stringify(fixture), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    })
  return JSON.parse(output)
}
describe('player runner lifecycle and deadline', () => {
  it.each([1000, 3100])('rejects completed goals at or beyond the %i ms deadline', maxDurationMs => {
    const { report, exitCode } = run({ scenario: { maxDurationMs } })
    expect(report.status).toBe('INCOMPLETE')
    expect(report.error).toBe('Scenario execution limit')
    expect(report.completedStages).toEqual([])
    expect(report.elapsedMs).toBe(3100)
    expect(exitCode).toBe(1)
  })
  it('does not execute an action after model latency consumes the deadline', () => {
    const result = run({ modelMs: 1500, scenario: { maxDurationMs: 1000 } })
    expect(result.report.status).toBe('INCOMPLETE')
    expect(result.report.error).toBe('Scenario execution limit')
    expect(result.executed).toEqual([])
    expect(result.report.inputTokens).toBe(1)
  })
  it('checks the deadline again before final PASS after stage evidence capture', () => {
    const result = run({ stageScreenshotMs: 500, scenario: { maxDurationMs: 3500 } })
    expect(result.report.status).toBe('INCOMPLETE')
    expect(result.report.error).toBe('Scenario execution limit')
    expect(result.report.elapsedMs).toBe(3600)
  })
  it('accepts completion on the last allowed step within the deadline', () => {
    const result = run({ scenario: { maxSteps: 1 } })
    expect(result.report.status).toBe('PASS')
    expect(result.report.steps).toBe(1)
    expect(result.exitCode).toBe(0)
  })
  it('wins, explicitly retries and observes progress during a second complete battle', () => {
    const result = run({
      scenario: { maxDurationMs: 240000, stages: [
        { id: 'calibrate', goal: 'Probe movement', allowed: ['calibrate_forward'],
          until: [{ field: 'hpRatio', op: 'lte', value: 0.99 }] },
        win, retry, { ...win, id: 'second-victory' },
      ] },
      actions: [
        { id: 'calibrate_forward', after: { ...playing, hpRatio: 0.98,
          map: { player: { x: 80, y: 75 }, targets: playing.map.targets } } },
        { id: 'attack', after: victory },
        { id: 'click_retry', after: playing },
        { id: 'attack', after: { ...playing, ko: 150, remaining: 150 }, elapsedMs: 60000 },
        { id: 'attack', after: { ...playing, ko: 250, remaining: 50 }, elapsedMs: 60000 },
        { id: 'attack', after: victory, elapsedMs: 60000 },
      ],
    })
    expect(result.report.status).toBe('PASS')
    expect(result.report.completedStages.map(stage => stage.id)).toEqual(['calibrate', 'victory', 'retry', 'second-victory'])
    expect(result.executed).toEqual(['calibrate_forward', 'attack', 'click_retry', 'attack', 'attack', 'attack'])
    const calibration = result.traces.find(row => row.type === 'step' && row.action.id === 'calibrate_forward')
    expect(calibration.navigation.forward).toEqual({ x: 0, y: -1 })
    const retryStep = result.traces.find(row => row.type === 'step' && row.action.id === 'click_retry')
    expect(retryStep.navigation).toEqual({ forward: null, right: null, blocked: 0 })
  })
  it('retains the unexpected-victory stop without an explicit retry allowance', () => {
    const result = run({ scenario: { stages: [win, { ...retry, allowed: undefined }] } })
    expect(result.report.status).toBe('INCOMPLETE')
    expect(result.report.error).toBe('Victory reached before required conditions passed')
    expect(result.executed).toEqual(['attack'])
  })
  it('cannot retry when the configured button is absent from the visible controls', () => {
    const result = run({
      scenario: { stages: [win, retry] }, actions: [{ id: 'attack', after: { ...victory, controls: [] } }],
    })
    expect(result.report.status).toBe('INCOMPLETE')
    expect(result.report.error).toBe('Victory reached before required conditions passed')
    expect(result.executed).toEqual(['attack'])
  })
  it('retains the unexpected-defeat stop', () => {
    const result = run({ actions: [{ id: 'attack', after: { ...victory, mode: 'defeat', ko: 0 } }] })
    expect(result.report.status).toBe('INCOMPLETE')
    expect(result.report.error).toBe('Player defeated')
  })
  it('permits retry from a defeat screen only when the scenario explicitly requests it', () => {
    const result = run({
      initial: { ...victory, mode: 'defeat', ko: 0 },
      scenario: { stages: [retry] }, actions: [{ id: 'click_retry', after: playing }],
    })
    expect(result.report.status).toBe('PASS')
    expect(result.executed).toEqual(['click_retry'])
  })
})
