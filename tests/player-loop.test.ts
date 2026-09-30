import { describe, expect, it } from 'vitest'
import { acceptedChoice, cacheKey, offers, requestDecision, stageComplete, validateScenario, readMapPixels, updateNavigation, type Observation, type Stage } from '../src/testing/player-loop.ts'
const observed: Observation = { documentId: 1, mode: 'playing', focused: true, controls: [], text: 'WASD J K F Esc L', ko: 0, remaining: 300, hpRatio: 1, musouReady: false, moveName: '', moveHint: '', resultText: '', map: { player: { x: 80, y: 90 }, targets: [{ x: 80, y: 45 }] } }
const stage: Stage = { id: 'win', goal: 'Win', until: [{ field: 'mode', op: 'eq', value: 'victory' }, { field: 'ko', op: 'eq', value: 300 }] }
const nav = { forward: null, right: null, blocked: 0 }
describe('visible player loop', () => {
  it('title offers only observed buttons despite remembering combat keys', () => {
    expect(offers({ ...observed, mode: 'title', controls: [{ id: 'start', name: '出陣' }] }, 'WASD J K L', nav, stage).map(a => a.id)).toEqual(['click_start'])
  })
  it('does not offer unobserved keys or unavailable musou', () => {
    expect(offers({ ...observed, text: '' }, '', nav, stage)).toEqual([])
    expect(offers(observed, '', nav, stage).some(a => a.id === 'musou')).toBe(false)
    expect(offers({ ...observed, musouReady: true }, '', nav, stage).some(a => a.id === 'musou')).toBe(true)
  })
  it('does not offer combat under paused overlay or unfocused page', () => {
    expect(offers({ ...observed, mode: 'paused' }, '', nav, stage)).toEqual([])
    expect(offers({ ...observed, focused: false }, '', nav, stage)).toEqual([])
  })
  it('learns direction from observed displacement and steers accordingly', () => {
    const action = offers(observed, '', nav, stage).find(a => a.id === 'calibrate_forward')!
    const learned = updateNavigation(nav, action, observed, { ...observed, map: { player: { x: 80, y: 85 }, targets: [] } })
    expect(learned.forward).toEqual({ x: 0, y: -1 })
    expect(offers(observed, '', { ...learned, right: { x: 1, y: 0 } }, stage).find(a => a.id === 'approach')?.keys).toEqual(['KeyW'])
  })
  it('victory with missing or incorrect KO cannot pass', () => {
    expect(stageComplete({ ...observed, mode: 'victory', ko: null }, stage)).toBe(false)
    expect(stageComplete({ ...observed, mode: 'victory', ko: 299 }, stage)).toBe(false)
    expect(stageComplete({ ...observed, mode: 'victory', ko: 300 }, stage)).toBe(true)
  })
  it('offers waiting for observed end transition without prematurely passing', () => {
    const finishing = { ...observed, ko: 300, remaining: 0 }
    expect(offers(finishing, '', nav, stage).some(a => a.id === 'wait_result')).toBe(true)
    expect(offers(observed, '', nav, stage).some(a => a.id === 'wait_result')).toBe(false)
    expect(stageComplete(finishing, stage)).toBe(false)
  })
  it('moving markers do not invalidate an unrelated normal-attack decision', () => {
    const learned = { ...nav, forward: { x: 0, y: -1 }, right: { x: 1, y: 0 } }
    const left = { ...observed, map: { player: { x: 80, y: 80 }, targets: [{ x: 75, y: 80 }] } }
    const right = { ...left, map: { ...left.map, targets: [{ x: 85, y: 80 }] } }
    const request = (o: Observation) => requestDecision('Win', stage, o, learned, offers(o, '', learned, stage))
    expect(cacheKey(request(left))).toBe(cacheKey(request(right)))
    expect(offers(left, '', learned, stage).find(a => a.id === 'approach')?.keys).not.toEqual(offers(right, '', learned, stage).find(a => a.id === 'approach')?.keys)
  })
  it('stage filters cannot create unavailable actions', () => {
    expect(offers(observed, '', nav, { ...stage, allowed: ['pause'] }).map(a => a.id)).toEqual(['pause'])
    expect(offers(observed, '', nav, { ...stage, allowed: ['fillMusou'] })).toEqual([])
  })
  it('cache invalidates on action availability, goal or health band change', () => {
    const request = (o = observed, s = stage) => requestDecision('Goal', s, o, nav, offers(o, '', nav, s))
    const key = cacheKey(request())
    expect(cacheKey(request({ ...observed, musouReady: true }))).not.toBe(key)
    expect(cacheKey(request({ ...observed, hpRatio: 0.1 }))).not.toBe(key)
    expect(cacheKey(request(observed, { ...stage, goal: 'Pause' }))).not.toBe(key)
  })
  it('rejects invented and low-confidence decisions', () => {
    const request = requestDecision('Goal', stage, observed, nav, offers(observed, '', nav, stage))
    const probabilities = Object.fromEntries(Object.keys(request.questions.next_action.criteria).map(k => [k, k === 'attack' ? 1 : 0]))
    const raw = { model: 'jev-1.13.0', answers: { next_action: { type: 'choice', choice: 'attack', confidence: 1, probabilities } } }
    expect(acceptedChoice(raw, request, 0.6)).toBe('attack')
    expect(acceptedChoice({ ...raw, model: 'other' }, request, 0.6)).toBeNull()
    raw.answers.next_action.choice = 'fillMusou'
    expect(acceptedChoice(raw, request, 0.6)).toBeNull()
    raw.answers.next_action.choice = 'attack'
    raw.answers.next_action.confidence = 0.4
    expect(acceptedChoice(raw, request, 0.6)).toBeNull()
  })
  it('recognizes painted player and enemy pixels', () => {
    const pixels = new Uint8Array(4 * 4 * 4)
    pixels.set([125, 255, 176, 255], 0)
    pixels.set([255, 90, 74, 255], 8)
    pixels.set([255, 90, 74, 255], 12)
    expect(readMapPixels(pixels, 4, 4)).toEqual({ player: { x: 0, y: 0 }, targets: [{ x: 2.5, y: 0 }] })
  })
  it('rejects malformed limits and empty success conditions', () => {
    const scenario = { id: 'test', goal: 'Win', maxSteps: 100, maxDurationMs: 60000, noProgressMs: 10000, confidenceThreshold: 0.6, stages: [stage] }
    expect(validateScenario(scenario)).toEqual(scenario)
    expect(() => validateScenario({ ...scenario, maxSteps: Infinity })).toThrow()
    expect(() => validateScenario({ ...scenario, stages: [{ ...stage, until: [] }] })).toThrow()
  })
})
