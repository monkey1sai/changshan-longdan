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

  // Guards the coverage added after review: regenerating the fixture cannot silently drop these cases.
  it('keeps the moving-action, auto-aim and hit-shape coverage', () => {
    const ids = new Set(fresh.player.map((t: { id: string }) => t.id))
    expect(ids.size).toBe(26)
    for (const id of ['attack_while_running', 'attack_then_jump_cancel', 'guard_turn_then_dodge', 'auto_aim_target',
      'buffer_kept_within_450ms', 'buffer_expires_after_450ms']) expect(ids.has(id), id).toBe(true)
    const aimed = fresh.player.filter((t: { aim: unknown }) => t.aim !== null)
    expect(aimed.map((t: { id: string }) => t.id)).toEqual(['auto_aim_target', 'auto_aim_target', 'auto_aim_target'])
    const shapes = fresh.hitShapes as { kind: string; offset: number; bits: string }[]
    expect(shapes).toHaveLength(72)
    expect(new Set(shapes.map((s) => s.kind))).toEqual(new Set(['arc', 'circle', 'line']))
    expect(shapes.filter((s) => s.offset !== 0)).toHaveLength(6)
    for (const s of shapes) {
      expect(s.bits).toHaveLength(242)
      expect(s.bits).toMatch(/1/)
      expect(s.bits).toMatch(/0/)
    }
  })
})
