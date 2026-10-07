// Fail closed over the 9s walk and separate 6s DEV presentation tail. No subjective tempo gate.
export function validateE11Route(route, fixture) {
  const fail = message => { throw new Error(`E11_ROUTE_INVALID: ${message}`) }
  const plan = fixture?.route
  const reference = fixture?.scenarios?.find(s => s.id === plan?.id)
  if (!plan || !reference || !fixture.sources || Object.keys(fixture.sources).length < 2) fail('missing fixture provenance')
  if (route?.mode !== 'e11-director' || route.duration !== 15 || route.routeDuration !== 9 || route.frameRate !== 30 || route.pausedFrames !== 0) fail('mode/duration/rate/paused')
  if (route.seed !== plan.seed || route.resetCount !== plan.resets || route.cameraYaw !== plan.cameraYaw || route.routeId !== plan.id || route.difficulty !== 'normal') fail('seed/reset/camera/route/difficulty')
  if (route.dt !== 1 / plan.hz || route.startingLocale !== 'zh-Hant' || route.flow !== 'title->battle') fail('dt/locale/flow')
  if (!Number.isInteger(route.viewportWidth) || route.viewportWidth <= 0 || !Number.isInteger(route.viewportHeight) || route.viewportHeight <= 0 || !Number.isFinite(route.renderScale) || route.renderScale <= 0) fail('viewport/render scale missing')
  if (route.inputSchedule !== 'W:[0,9); cameraYaw=PI' || route.evidenceKind !== 'scripted_walk_then_DEV_presentation_probe' || typeof route.injections !== 'string' || !route.injections.includes('presentation only; no KO mutation')) fail('input/injection evidence kind')
  if (route.castleAssets !== 'Ready') fail('E10 castle assets missing')
  if (!Array.isArray(route.frames) || route.frames.length !== 450 || !Array.isArray(route.summaries) || route.summaries.length !== 9 || reference.summaries.length !== 9) fail('incomplete trace')
  const continuous = ['x', 'z', 'hp', 'simTime']
  const exact = ['f', 'alive', 'engaged', 'attackers', 'ko', 'phase', 'state', 'stepped', 'inputMove', 'operationalIdle', 'rawInputNoProgress', 'eligibleMove', 'eligibleStuck']
  let maxDeviation = 0, raw = 0, eligibleStuck = 0, idle = 0, encounters = 0
  let wasEngaged = false
  const encounterFrames = []
  const walk = []
  for (let i = 0; i < route.frames.length; i++) {
    const frame = route.frames[i]
    if (frame.f !== i || !Number.isFinite(frame.simTime)) fail(`frame sequence ${i}`)
    if (frame.yaw !== Math.PI) fail(`camera yaw ${i}`)
    // JsonUtility may serialize an unassigned inline Sample as its default values; segment and frame bounds
    // define membership. Tail samples are never counted as walk or compared against the 9s reference.
    if (i >= 270) { if (frame.segment !== 'dev_banner_probe') fail(`tail classified as walk ${i}`); continue }
    const sample = frame.director
    if (frame.segment !== 'scripted_walk' || !sample || sample.f !== i) fail(`missing walk sample ${i}`)
    for (const k of continuous) if (!Number.isFinite(sample[k])) fail(`nonfinite ${i}.${k}`)
    for (const k of ['alive', 'engaged', 'attackers', 'ko']) if (!Number.isInteger(sample[k]) || sample[k] < 0) fail(`invalid count ${i}.${k}`)
    for (const k of exact.slice(7)) if (typeof sample[k] !== 'boolean') fail(`missing diagnostic ${i}.${k}`)
    if (sample.engaged > sample.alive || sample.attackers > 4 || sample.ko !== 0 || sample.phase !== 'opening') fail(`walk invariant ${i}`)
    if (sample.operationalIdle !== (sample.hp > 0 && sample.alive > 0 && sample.engaged === 0)) fail(`idle definition ${i}`)
    if (sample.eligibleStuck !== (sample.eligibleMove && sample.rawInputNoProgress) || sample.eligibleMove && (!sample.stepped || sample.hp <= 0 || sample.state !== 'move')) fail(`eligible definition ${i}`)
    raw += Number(sample.rawInputNoProgress); eligibleStuck += Number(sample.eligibleStuck); idle += Number(sample.operationalIdle)
    if (sample.engaged > 0 && !wasEngaged) { encounters++; encounterFrames.push(i) }
    wasEngaged = sample.engaged > 0
    walk.push(sample)
  }
  for (let i = 0; i < 9; i++) {
    const actual = route.summaries[i], expected = reference.summaries[i], frame = walk[(i + 1) * 30 - 1]
    for (const k of [...exact, ...continuous]) if (actual[k] !== frame[k]) fail(`summary not derived from frame ${i}.${k}`)
    for (const k of exact) if (actual[k] !== expected[k]) fail(`first parity difference ${actual.f}.${k}: expected ${expected[k]}, got ${actual[k]}`)
    for (const k of continuous) {
      const deviation = Math.abs(actual[k] - expected[k]); maxDeviation = Math.max(maxDeviation, deviation)
      if (deviation > plan.positionTolerance) fail(`first parity difference ${actual.f}.${k}: deviation ${deviation}; tolerance ${plan.positionTolerance}`)
    }
  }
  for (const target of plan.mustVisit) if (!walk.some(s => Math.hypot(s.x - target.x, s.z - target.z) <= target.radius)) fail(`unvisited ${target.id}`)
  if (eligibleStuck / 30 > plan.maxEligibleStuckSeconds) fail(`eligible stuck ${eligibleStuck / 30}s`)
  const banners = [[270, 'zh-Hant', '敵軍壓上！', false], [300, 'en', 'The enemy advances!', false], [330, 'en', '100 KOs!', true],
    [360, 'zh-Hant', '100 人斬！', true], [390, 'zh-Hant', '魏軍 半數潰滅', false], [420, 'en', 'Half the Wei Army Defeated', false]]
  for (const [f, locale, text, gold] of banners) {
    const s = route.frames[f]
    if (s.locale !== locale || s.bannerText !== text || s.bannerGold !== gold || !Number.isFinite(s.bannerLeft) || s.bannerLeft <= 0 || s.bannerLeft > 2 || !s.injection?.startsWith('DEV')) fail(`presentation probe ${f}`)
  }
  return { walkSeconds: 9, devPresentationSeconds: 6, naturalKo: 0, phases: ['opening'], encounters,
    rawInputNoProgressSeconds: raw / 30, eligibleStuckSeconds: eligibleStuck / 30, operationalIdleSeconds: idle / 30,
    idleQualityThreshold: null, maxParityDeviation: maxDeviation, positionTolerance: plan.positionTolerance,
    eligibleMoveSeconds: walk.filter(s => s.eligibleMove).length / 30,
    actualStepSeconds: walk.filter(s => s.stepped).length / 30,
    encounterStartSeconds: encounterFrames.map(f => f / 30),
    encounterIntervalsSeconds: encounterFrames.slice(1).map((f, i) => (f - encounterFrames[i]) / 30),
    meanEncounterIntervalSeconds: encounterFrames.length > 1 ? (encounterFrames.at(-1) - encounterFrames[0]) / 30 / (encounterFrames.length - 1) : null,
    visited: plan.mustVisit.map(t => t.id), presentationOnlyBannerProbes: banners.length }
}
