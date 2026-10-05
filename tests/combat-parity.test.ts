import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOVES, type MoveId } from '../src/combat/moves.ts'
import { buildParityFixture } from '../scripts/lib/combat-parity.ts'

const root = new URL('../', import.meta.url)
const committed = readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-parity.json', root), 'utf8')

describe('Web-to-Unity combat parity fixture', () => {
  const text = `${JSON.stringify(buildParityFixture(root))}\n`
  const fresh = JSON.parse(text)

  it('matches the committed fixture byte for byte after regeneration', () => {
    expect(committed === text, 'web-parity.json is stale; run npm run parity:write').toBe(true)
  })

  it('reaches every move through the scripted player traces', () => {
    const started = new Set<string>()
    for (const trace of fresh.player) for (const frame of trace.frames) for (const e of frame.e) {
      if (e.startsWith('moveStart:')) started.add(e.slice('moveStart:'.length))
    }
    expect([...started].sort()).toEqual((Object.keys(MOVES) as MoveId[]).sort())
  })

  it('covers each scenario at 30, 60 and 120 Hz', () => {
    for (const trace of fresh.player) expect(trace.frames.length).toBeGreaterThan(0)
    const rates = new Set(fresh.player.map((t: { hz: number }) => t.hz))
    expect([...rates]).toEqual([30, 60, 120])
  })
})
