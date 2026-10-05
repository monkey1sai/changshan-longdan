import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildHitFixture } from '../scripts/lib/hit-parity.ts'

const root = new URL('../', import.meta.url)
const committed = readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-hits.json', root), 'utf8')

type Hit = [string, number, number, number]
interface Scenario { id: string; hz: number; divergent: boolean; targets: number[][]; frames: { hs: number; h?: Hit[] }[] }

describe('Web-to-Unity hit parity fixture', () => {
  const text = `${JSON.stringify(buildHitFixture(root))}\n`
  const fresh = JSON.parse(text) as { scenarios: Scenario[] }
  const hits = (s: Scenario) => s.frames.flatMap((f) => f.h ?? [])

  it('matches the committed fixture byte for byte after regeneration', () => {
    expect(committed === text, 'web-hits.json is stale; run npm run parity:write').toBe(true)
  })

  // Guards the E05 acceptance set: regenerating the fixture cannot silently drop a case.
  it('keeps every required scenario', () => {
    const ids = new Set(fresh.scenarios.map((s) => s.id))
    expect(ids.size).toBe(21)
    for (const move of ['n1', 'n4', 'c5', 'musou']) for (const n of [1, 5, 20]) expect(ids.has(`${move}_x${n}`), `${move}_x${n}`).toBe(true)
    expect(fresh.scenarios.filter((s) => s.hz === 20).map((s) => s.id)).toEqual(['c5_windows_shorter_than_step'])
  })

  it('records the Web single-stamp duplicate only in the interleaving case', () => {
    for (const s of fresh.scenarios) {
      const pairs = hits(s).filter((h) => h[0].startsWith('P')).map((h) => `${h[0]}>${h[1]}`)
      const duplicates = pairs.length - new Set(pairs).size
      if (s.divergent) expect(duplicates, `${s.id}@${s.hz}`).toBeGreaterThan(0)
      else expect(duplicates, `${s.id}@${s.hz}`).toBe(0)
    }
  })

  it('straddles each boundary sweep and keeps hit-stop at the longest request', () => {
    for (const s of fresh.scenarios) {
      if (s.id.endsWith('_sweep')) {
        const reached = new Set(hits(s).map((h) => h[1])).size
        expect(reached, `${s.id}@${s.hz}`).toBeGreaterThan(0)
        expect(reached, `${s.id}@${s.hz}`).toBeLessThan(s.targets.length)
      }
      expect(Math.max(...s.frames.map((f) => f.hs)), `${s.id}@${s.hz}`).toBeLessThanOrEqual(0.11)
    }
  })
})
