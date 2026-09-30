import { describe, expect, it } from 'vitest'
import { acceptUiAction, buildUiActionRequest, type UiSnapshot } from '../src/testing/ui-actions.ts'

const snapshot: UiSnapshot = {
  documentId: 'title-1', renderedText: '出陣 按 Enter 開始',
  controls: [
    { id: 'start', role: 'button', name: '出陣', enabled: true },
    { id: 'disabled', role: 'button', name: '不可用', enabled: false },
    { id: 'language', role: 'select', name: '語言', enabled: true, options: [
      { value: 'zh', label: '中文', selected: true, disabled: false },
      { value: 'en', label: 'English', selected: false, disabled: false },
    ] },
  ],
}
const plan = buildUiActionRequest('按出陣後檢查血條', snapshot)
const reply = { model: 'jev-1.13.0', answers: { next_action: {
  type: 'choice', choice: 'action_0', confidence: 0.99,
  probabilities: { action_0: 0.99, action_1: 0, no_action: 0.01 },
} } }
describe('current-page UI choices', () => {
  it('offers observed enabled controls only, with no game hooks or hidden future controls', () => {
    expect(Object.values(plan.actions)).toEqual([
      { kind: 'click', controlId: 'start' },
      { kind: 'select', controlId: 'language', value: 'en' },
    ])
    expect(JSON.stringify(plan)).not.toContain('fillMusou')
    expect(JSON.stringify(plan.actions)).not.toContain('resume')
  })
  it('accepts only a current observed action', () => {
    expect(acceptUiAction(plan, reply, snapshot)).toEqual({ kind: 'click', controlId: 'start' })
  })
  it('rejects changed documents, controls and page text', () => {
    expect(acceptUiAction(plan, reply, { ...snapshot, documentId: 'new-page' })).toBeNull()
    expect(acceptUiAction(plan, reply, { ...snapshot, controls: [] })).toBeNull()
    expect(acceptUiAction(plan, reply, { ...snapshot, renderedText: 'Paused' })).toBeNull()
  })
  it('rejects invented actions and uncertainty', () => {
    const raw = structuredClone(reply)
    raw.answers.next_action.choice = 'fillMusou'
    expect(acceptUiAction(plan, raw, snapshot)).toBeNull()
    raw.answers.next_action.choice = 'action_0'
    raw.answers.next_action.confidence = 0.5
    expect(acceptUiAction(plan, raw, snapshot)).toBeNull()
  })
})
