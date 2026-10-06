import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOVES } from '../src/combat/moves.ts'
import { RIG_RATES, RIG_SCENARIOS, buildRigFixture } from '../scripts/lib/rig-parity.ts'

const root = new URL('../', import.meta.url)
const committed = readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-rig.json', root), 'utf8')

interface Scenario { id: string; hz: number; duration: number; frames: unknown[]; started: string[] }

describe('Web-to-Unity rig parity fixture', async () => {
  const text = `${JSON.stringify(await buildRigFixture(root))}\n`
  const fresh = JSON.parse(text) as { scenarios: Scenario[] }

  it('matches the committed fixture byte for byte after regeneration', () => {
    expect(committed === text, 'web-rig.json is stale; run npm run parity:write').toBe(true)
  })

  // Guards the E06 route: regenerating the fixture cannot silently drop a scenario or a rate.
  it('keeps every scenario at every rate', () => {
    for (const hz of RIG_RATES) {
      expect(fresh.scenarios.filter((s) => s.hz === hz).map((s) => s.id), `${hz} Hz`).toEqual(RIG_SCENARIOS.map((s) => s.id))
    }
    for (const s of fresh.scenarios) expect(s.frames.length, `${s.id}@${s.hz}`).toBeGreaterThan(0)
  })

  it('starts every move at least once at 60 Hz', () => {
    const started = new Set(fresh.scenarios.filter((s) => s.hz === 60).flatMap((s) => s.started))
    expect([...started].sort()).toEqual(Object.keys(MOVES).sort())
  })
})
