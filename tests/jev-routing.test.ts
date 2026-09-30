import { describe, expect, it } from 'vitest'
import { acceptRoutingAnswer, buildRoutingRequest } from '../src/testing/jev-routing.ts'
import { compactState, runCase, type GameProbe, type ProbeState } from '../src/testing/regression.ts'
import { routingFixtures } from '../src/testing/routing-fixtures.ts'

const state: ProbeState = {
  mode: 'title', hp: 1000, musou: 0, playerState: 'move', move: null,
  alive: 300, ko: 0, counterReady: 0, facing: 0, position: [0, 0, 0],
}
const request = buildRoutingRequest('測試格擋', state, [], 'jev-1.13.0')
function response(choice = 'guard', confidence = 0.99) {
  return { answers: { next_case: { type: 'choice', choice, confidence,
    probabilities: Object.fromEntries(Object.keys(request.questions.next_case.criteria).map(id => [id, id === choice ? 1 : 0])),
  } } }
}
describe('bounded regression routing', () => {
  it('keeps holdout prompts distinct and expected labels outside provider state', () => {
    const baselineGoals = new Set(routingFixtures().map(f => f.request.state.goal))
    const holdout = routingFixtures('holdout')
    expect(holdout).toHaveLength(18)
    for (const fixture of holdout) {
      expect(baselineGoals.has(fixture.request.state.goal)).toBe(false)
      expect(fixture.request.state).not.toHaveProperty('expected')
      expect(fixture.request.questions.next_case.criteria).toHaveProperty(fixture.expected)
    }
  })
  it('copies observations and excludes unrelated fields and completed cases', () => {
    const req = buildRoutingRequest('測試格擋', { ...state, ...{ secret: 'private' } }, ['attack'], 'jev-1.13.0')
    expect(JSON.stringify(req)).not.toContain('secret')
    expect(req.questions.next_case.criteria).not.toHaveProperty('attack')
    expect(compactState(state).position).not.toBe(state.position)
  })
  it('accepts a validated choice as test selection only', () => {
    expect(acceptRoutingAnswer(request, response(), 0.9)).toEqual({ kind: 'case', id: 'guard' })
  })
  it.each([null, {}, response('shell'), response('guard', NaN), response('guard', 1.1)])('rejects malformed output %#', raw => {
    expect(acceptRoutingAnswer(request, raw, 0.9).kind).toBe('escalate')
  })
  it('escalates uncertainty and unsupported tasks', () => {
    expect(acceptRoutingAnswer(request, response('guard', 0.5), 0.9)).toEqual({ kind: 'escalate', reason: 'uncertain' })
    expect(acceptRoutingAnswer(request, response('escalate'), 0.9)).toEqual({ kind: 'escalate', reason: 'no_match' })
  })
  it('rejects a stale choice for a completed case', () => {
    const changed = buildRoutingRequest('測試格擋', state, ['guard'], 'jev-1.13.0')
    expect(acceptRoutingAnswer(changed, response(), 0.9).kind).toBe('escalate')
  })
  it('rejects incomplete or inconsistent probabilities', () => {
    const raw = response()
    raw.answers.next_case.probabilities.guard = 0.4
    expect(acceptRoutingAnswer(request, raw, 0.9).kind).toBe('escalate')
    raw.answers.next_case.probabilities.escalate = 0.6
    expect(acceptRoutingAnswer(request, raw, 0.9).kind).toBe('escalate')
  })
  it('accepts approximate totals caused by two-decimal probability rounding', () => {
    const raw = response()
    raw.answers.next_case.probabilities.guard = 0.98
    raw.answers.next_case.probabilities.attack = 0.01
    expect(acceptRoutingAnswer(request, raw, 0.9)).toEqual({ kind: 'case', id: 'guard' })
    raw.answers.next_case.probabilities.attack = 0.03
    expect(acceptRoutingAnswer(request, raw, 0.9)).toEqual({ kind: 'case', id: 'guard' })
    raw.answers.next_case.probabilities.attack = 0.1
    expect(acceptRoutingAnswer(request, raw, 0.9).kind).toBe('escalate')
  })
  it('never marks a broken game or missing DOM evidence as PASS', () => {
    const probe: GameProbe = { state, start() {}, advance() { return state }, strike() {}, fillMusou() {}, setHp() {}, setTimeScale() {} }
    expect(runCase('start', probe, () => true).status).toBe('FAIL')
    expect(runCase('start', probe, () => { throw new Error('Missing DOM') }).status).toBe('ERROR')
  })
  it('rejects invalid request settings', () => {
    expect(() => buildRoutingRequest('', state, [], 'jev-1.13.0')).toThrow()
    expect(() => acceptRoutingAnswer(request, response(), NaN)).toThrow()
  })
})
