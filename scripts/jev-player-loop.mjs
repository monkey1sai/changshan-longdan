import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { observe, execute, readTitleHints } from './lib/player-ui.mjs'
import { validateScenario, stageComplete, offers, requestDecision, acceptedChoice, cacheKey, updateNavigation, nearest } from '../src/testing/player-loop.ts'

const args = process.argv.slice(2)
if (!args.includes('--live') || args.some(a => a !== '--live' && !a.startsWith('--scenario='))) {
  console.log('Usage: node --experimental-strip-types scripts/jev-player-loop.mjs --live --scenario=tests/scenarios/victory.json')
  process.exit(2)
}
const key = process.env.TYPESAFE_API_KEY
if (!key) throw new Error('Credential unavailable')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scenarioPath = resolve(root, args.find(a => a.startsWith('--scenario='))?.slice(11) ?? 'tests/scenarios/victory.json')
const scenario = validateScenario(JSON.parse(await readFile(scenarioPath, 'utf8')))
const output = resolve(root, 'artifacts', 'player-loop', new Date().toISOString().replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const report = {
  status: 'RUNNING', scenario, scope: 'headed Chrome, visible UI/pixels, real mouse and keyboard only',
  calls: 0, cacheHits: 0, executedCacheSteps: 0, staleDiscards: 0, steps: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
  costComplete: true, completedStages: [], pageErrors: [], screenshots: [], sourceHashes: {},
}
for (const file of ['scripts/jev-player-loop.mjs', 'scripts/lib/player-ui.mjs', 'src/testing/player-loop.ts', 'index.html', 'src/game.ts', 'src/entities/player.ts', 'src/entities/enemies.ts']) {
  report.sourceHashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')
}
report.scenarioHash = createHash('sha256').update(await readFile(scenarioPath)).digest('hex')
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
const trace = row => appendFile(resolve(output, 'trace.jsonl'), JSON.stringify(row) + '\n')
let browser, server, page
let documentId = 0
const started = performance.now()
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright')
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: true } })
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Local server unavailable')
  browser = await chromium.launch({ channel: 'chrome', headless: false })
  report.browserVersion = browser.version()
  page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.pageErrors.push(error.message))
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) documentId++ })
  await page.goto('http://127.0.0.1:' + address.port, { waitUntil: 'load' })
  await page.bringToFront()
  await page.locator('#start').waitFor({ state: 'visible' })
  const capture = () => observe(page, documentId)
  const screenshot = async name => {
    const path = resolve(output, name + '.png')
    await page.screenshot({ path })
    report.screenshots.push(path)
    console.log('SCREENSHOT ' + path)
  }
  const hints = await readTitleHints(page, capture)
  await writeFile(resolve(output, 'observed-instructions.txt'), hints)
  await screenshot('000-title')
  const cache = new Map()
  let navigation = { forward: null, right: null, blocked: 0 }
  let stageIndex = 0, lastKo = 0, lastProgress = performance.now(), lastScreenshotKo = 0
  let observation = await capture()
  const initialDocumentId = documentId
  while (stageIndex < scenario.stages.length) {
    report.elapsedMs = performance.now() - started
    report.lastObservation = observation
    const stage = scenario.stages[stageIndex]
    if (!observation.focused) throw new Error('Visible focused browser required')
    if (observation.documentId !== initialDocumentId) throw new Error('Unexpected document navigation')
    if (report.pageErrors.length) throw new Error('Browser runtime error')
    if (stageComplete(observation, stage)) {
      report.completedStages.push({ id: stage.id, step: report.steps, observation })
      console.log('STAGE PASS ' + stage.id)
      await screenshot('stage-' + stage.id)
      stageIndex++
      lastProgress = performance.now()
      continue
    }
    if (report.pageErrors.length) throw new Error('Browser runtime error')
    if (observation.mode === 'defeat') throw new Error('Player defeated')
    if (observation.mode === 'victory') throw new Error('Victory reached before required conditions passed')
    if (report.steps >= scenario.maxSteps || report.elapsedMs >= scenario.maxDurationMs) throw new Error('Scenario execution limit')
    if (performance.now() - lastProgress > scenario.noProgressMs) throw new Error('No visible KO or stage progress within configured limit')
    const actions = offers(observation, hints, navigation, stage)
    if (!actions.length) throw new Error('No currently legal configured action')
    const request = requestDecision(scenario.goal, stage, observation, navigation, actions)
    const decisionKey = cacheKey(request)
    let selected = cache.get(decisionKey), source = 'cache'
    if (!selected) {
      source = 'jev'
      report.calls++
      report.costComplete = false
      await save()
      const callStart = performance.now()
      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!response.ok) throw new Error('Provider HTTP ' + response.status)
      const raw = await response.json()
      await trace({ type: 'decision', step: report.steps, request, response: raw, modelMs: performance.now() - callStart })
      if (!Number.isSafeInteger(raw.usage?.input_tokens) || raw.usage.input_tokens < 0
          || !Number.isSafeInteger(raw.usage?.output_tokens) || raw.usage.output_tokens < 0) throw new Error('Invalid provider usage')
      report.inputTokens += raw.usage.input_tokens
      report.outputTokens += raw.usage.output_tokens
      report.estimatedCostUsd = report.inputTokens * 0.042 / 1e6
      report.costComplete = true
      selected = acceptedChoice(raw, request, scenario.confidenceThreshold)
      if (!selected) throw new Error('No accepted Jev action')
      cache.set(decisionKey, selected)
    } else report.cacheHits++
    // Refresh after network latency; changed conditions discard the decision.
    const current = source === 'jev' ? await capture() : observation
    const currentActions = offers(current, hints, navigation, stage)
    if (current.documentId !== observation.documentId
        || cacheKey(requestDecision(scenario.goal, stage, current, navigation, currentActions)) !== decisionKey) {
      observation = current
      report.staleDiscards++
      await trace({ type: 'stale-discard', step: report.steps })
      continue
    }
    const action = currentActions.find(action => action.id === selected)
    if (!action) throw new Error('Selected action no longer legal')
    const actionStart = performance.now()
    const needsHeld = stage.until.some(c => c.field === 'moveName' || c.field === 'moveHint')
    const held = await execute(page, { ...action, observeHeld: needsHeld ? capture : undefined })
    const after = await capture()
    navigation = updateNavigation(navigation, action, current, after)
    report.steps++
    if (source === 'cache') report.executedCacheSteps++
    await trace({ type: 'step', step: report.steps, stage: stage.id, source, action, before: current, held, after, navigation, durationMs: performance.now() - actionStart })
    observation = held && stageComplete(held, stage) ? held : after
    if (after.ko !== null && after.ko > lastKo) { lastKo = after.ko; lastProgress = performance.now() }
    if (report.steps % 10 === 0 || after.ko >= lastScreenshotKo + 50 || after.mode === 'victory') {
      const target = nearest(after)
      console.log(JSON.stringify({ step: report.steps, action: action.id, mode: after.mode, ko: after.ko, remaining: after.remaining, hp: after.hpRatio, nearest: target && Math.round(target.distance), blocked: navigation.blocked, calls: report.calls, cacheHits: report.cacheHits }))
      await screenshot(String(report.steps).padStart(3, '0') + '-' + after.mode)
      if (after.ko !== null) lastScreenshotKo = after.ko
    }
    await save()
  }
  if (report.pageErrors.length) throw new Error('Browser runtime error')
  report.status = 'PASS'
  report.finalObservation = observation
} catch (error) {
  report.status = 'INCOMPLETE'
  report.error = error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]') : 'Unknown failure'
  report.failureClass = /Provider|fetch|network/i.test(report.error) ? 'NETWORK_FAILURE'
    : /defeated|progress|limit|conditions|Jev|legal|focused/i.test(report.error) ? 'TEST_FAILURE' : 'TOOL_FAILURE'
  if (page) {
    const path = resolve(output, 'failure.png')
    await page.screenshot({ path }).catch(() => {})
    report.screenshots.push(path)
  }
  process.exitCode = 1
} finally {
  report.elapsedMs = performance.now() - started
  await browser?.close()
  await server?.close()
  await save()
  console.log('REPORT ' + resolve(output, 'report.json'))
  console.log(JSON.stringify({ status: report.status, error: report.error, steps: report.steps, calls: report.calls, cacheHits: report.cacheHits, inputTokens: report.inputTokens, outputTokens: report.outputTokens, estimatedCostUsd: report.estimatedCostUsd, elapsedMs: report.elapsedMs }))
}
