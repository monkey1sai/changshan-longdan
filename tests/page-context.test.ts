import { describe, expect, it } from 'vitest'
import { CONTEXT_VARIANTS, withPageContext, type PageContext } from '../src/testing/page-context.ts'
import { routingFixtures } from '../src/testing/routing-fixtures.ts'

const context: PageContext = {
  title: '遊戲', subtitle: '三百敵兵',
  startButton: { role: 'button', name: '出陣', enabled: true },
  startPrompt: '點擊出陣開始', controlRows: [['普攻', 'J', 'X']],
  renderedText: '遊戲 出陣 普攻 J X',
}
describe('page evidence ablation', () => {
  it('changes only added evidence, never labels, questions or base observations', () => {
    const request = routingFixtures()[0]!.request
    const saved = JSON.stringify(request)
    for (const variant of CONTEXT_VARIANTS) {
      const result = withPageContext(request, context, variant)
      expect(result.questions).toEqual(request.questions)
      expect(result.model).toBe(request.model)
      expect(result.state.observation).toEqual(request.state.observation)
      expect(result.state.goal).toBe(request.state.goal)
      expect(result.state).not.toHaveProperty('expected')
    }
    expect(JSON.stringify(request)).toBe(saved)
  })
  it('does not copy unrelated fields into the provider context', () => {
    const extra = { ...context, token: 'private', expected: 'start' }
    const request = routingFixtures()[0]!.request
    for (const variant of CONTEXT_VARIANTS) {
      const serialized = JSON.stringify(withPageContext(request, extra, variant))
      expect(serialized).not.toContain('private')
      expect(serialized).not.toContain('"expected"')
    }
  })
  it('keeps compact input unchanged and isolates nested copies', () => {
    const request = routingFixtures()[0]!.request
    const result = withPageContext(request, context, 'compact')
    expect(result).toEqual(request)
    result.state.observation.position[0] = 99
    expect(request.state.observation.position[0]).not.toBe(99)
  })
})
