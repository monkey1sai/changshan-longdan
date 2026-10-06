import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRESENTATION_SCENARIOS, buildPresentationFixture } from '../scripts/lib/presentation-parity.ts'

const root = new URL('../', import.meta.url)
const committed = readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-presentation.json', root), 'utf8')

type Frame = { f: number; dt: number; e?: unknown[][]; c?: unknown[][]; r: number; n: number[] }
interface Scenario { id: string; hz: number; frames: Frame[] }

describe('Web-to-Unity presentation parity fixture', () => {
  const text = `${JSON.stringify(buildPresentationFixture(root))}\n`
  const fresh = JSON.parse(text) as { scenarios: Scenario[]; trail: { hz: number; frames: { n: number }[] }[] }

  it('matches the committed fixture byte for byte after regeneration', () => {
    expect(committed === text, 'web-presentation.json is stale; run npm run parity:write').toBe(true)
  })

  // Guards the E07 feedback acceptance set: regenerating cannot silently drop an event type or an output.
  it('drives every ported event and every output the Unity port must reproduce', () => {
    for (const s of PRESENTATION_SCENARIOS) {
      expect(fresh.scenarios.filter((x) => x.id === s.id).map((x) => x.hz), s.id).toEqual(s.rates)
    }
    const events = new Set(fresh.scenarios.flatMap((s) => s.frames.flatMap((f) => (f.e ?? []).map((e) => e[0] as string))))
    expect([...events].sort()).toEqual(['dodge', 'enemyStrike', 'fx', 'guardBlock', 'hit', 'hurt', 'jump', 'kill', 'land', 'musouReady', 'musouStart', 'parry', 'swing'])
    const calls = new Set(fresh.scenarios.flatMap((s) => s.frames.flatMap((f) => (f.c ?? []).map((c) => c[0] as string))))
    for (const name of ['audio.hit', 'audio.shatter', 'audio.musouBlast', 'sparks.burst', 'dust.ring', 'waves.pillar', 'fragments.spawnSoldier', 'camera.kick', 'hud.showBanner']) {
      expect(calls, name).toContain(name)
    }
    // The dragon is out of scope: none of its outputs may appear.
    expect([...calls].filter((c) => c === 'audio.dragonRoar' || c === 'sparks.glitter')).toEqual([])
    // Hit-stop frames advance nothing and draw nothing.
    const frozen = fresh.scenarios.flatMap((s) => s.frames.filter((f) => f.dt === 0))
    expect(frozen.length).toBeGreaterThan(10)
    expect(frozen.every((f) => f.r === 0 || (f.e ?? []).length > 0)).toBe(true)
    // The trail fills in a fast swing and empties after its lifetime.
    for (const t of fresh.trail) {
      expect(Math.max(...t.frames.map((f) => f.n)), `${t.hz} Hz`).toBeGreaterThan(4)
      expect(t.frames.at(-1)?.n, `${t.hz} Hz`).toBe(0)
    }
  })
})
