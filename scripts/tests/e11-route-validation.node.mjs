import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateE11Route } from '../lib/e11-route-validation.mjs'
const fixture = JSON.parse(readFileSync(new URL('../../unity/ChangshanLongdan/TestData/combat/web-director.json', import.meta.url), 'utf8'))
function route() {
  const walk = fixture.scenarios.find(s => s.id === fixture.route.id)
  const frames = Array.from({ length: 450 }, (_, f) => ({ f, simTime: (f + 1) / 30, yaw: Math.PI,
    segment: f < 270 ? 'scripted_walk' : 'dev_banner_probe', ...(f < 270 ? { director: structuredClone(walk.frames[f]) } : {}),
  }))
  const banners = [[270, 'zh-Hant', '敵軍壓上！', false], [300, 'en', 'The enemy advances!', false], [330, 'en', '100 KOs!', true],
    [360, 'zh-Hant', '100 人斬！', true], [390, 'zh-Hant', '魏軍 半數潰滅', false], [420, 'en', 'Half the Wei Army Defeated', false]]
  for (const [f, locale, bannerText, bannerGold] of banners) Object.assign(frames[f], { locale, bannerText, bannerGold, bannerLeft: 1, injection: 'DEV presentation probe' })
  return { mode: 'e11-director', duration: 15, routeDuration: 9, frameRate: 30, pausedFrames: 0, seed: 7, resetCount: 2,
    cameraYaw: Math.PI, routeId: fixture.route.id, difficulty: 'normal', inputSchedule: 'W:[0,9); cameraYaw=PI',
    dt: 1 / 30, startingLocale: 'zh-Hant', flow: 'title->battle',
    viewportWidth: 1280, viewportHeight: 720, renderScale: 1, // synthetic guard input, not rendered evidence
    evidenceKind: 'scripted_walk_then_DEV_presentation_probe', injections: 'presentation only; no KO mutation', castleAssets: 'Ready',
    frames, summaries: structuredClone(walk.summaries) }
}
test('accepts complete fixture-derived trace and separates walk from presentation probe', () => {
  const result = validateE11Route(route(), fixture)
  assert.equal(result.walkSeconds, 9); assert.equal(result.devPresentationSeconds, 6)
  assert.equal(result.naturalKo, 0); assert.equal(result.idleQualityThreshold, null)
})
for (const [label, mutate] of [
  ['incomplete frames', r => r.frames.pop()], ['missing provenance', r => delete r.inputSchedule],
  ['wrong reset count', r => r.resetCount = 1], ['missing assets', r => r.castleAssets = 'Failed'],
  ['missing dt', r => delete r.dt], ['wrong dt', r => r.dt = 1 / 60], ['wrong flow', r => r.flow = 'playing'],
  ['missing viewport', r => delete r.viewportWidth], ['nonfinite render scale', r => r.renderScale = NaN], ['nonpositive render scale', r => r.renderScale = 0],
  ['missing banner', r => r.frames[330].bannerText = ''], ['mislabelled tail', r => r.frames[300].segment = 'scripted_walk'],
  ['nonfinite position', r => r.frames[0].director.x = NaN], ['missing flag', r => delete r.frames[0].director.stepped],
  ['summary mismatch', r => r.summaries[0].engaged++], ['discrete parity difference', r => { r.frames[29].director.attackers++; r.summaries[0].attackers++ }],
  ['out of fixed tolerance', r => { r.frames[29].director.x += 0.00011; r.summaries[0].x += 0.00011 }],
]) test(`rejects ${label}`, () => { const r = route(); mutate(r); assert.throws(() => validateE11Route(r, fixture), /E11_ROUTE_INVALID/) })
test('position comparison accepts the fixed tolerance boundary', () => {
  const r = route(); r.frames[29].director.x += 0.000099; r.summaries[0].x += 0.000099
  assert.doesNotThrow(() => validateE11Route(r, fixture))
})
