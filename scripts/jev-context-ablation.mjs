import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { routingFixtures } from '../src/testing/routing-fixtures.ts'
import { CONTEXT_VARIANTS, withPageContext } from '../src/testing/page-context.ts'
import { acceptRoutingAnswer } from '../src/testing/jev-routing.ts'

const args = process.argv.slice(2)
if (args.length !== 1 || !['--live', '--capture-only'].includes(args[0])) {
  console.log('NOT_RUN: use --capture-only or an authorized --live invocation')
  process.exit(2)
}
const live = args[0] === '--live'
const key = live ? process.env.TYPESAFE_API_KEY : null
if (live && !key) throw new Error('TYPESAFE_API_KEY unavailable; no request sent')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'artifacts', 'jev-context', new Date().toISOString().replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const hash = value => createHash('sha256').update(value).digest('hex')
const sourceHashes = {}
for (const file of ['scripts/jev-context-ablation.mjs', 'src/testing/page-context.ts',
  'src/testing/jev-routing.ts', 'src/testing/routing-fixtures.ts', 'index.html']) {
  sourceHashes[file] = hash(await readFile(resolve(root, file)))
}
const baseline = routingFixtures()
const holdout = routingFixtures('holdout')
// Diagnostic subset selected before this run; explicitly not an independent holdout.
const fixtures = [
  ...baseline.slice(0, 6).map((f, index) => ({ ...f, id: 'baseline-' + index })),
  ...[0, 12, 13, 15, 16, 17].map(index => ({ ...holdout[index], id: 'holdout-' + index })),
]
const report = {
  status: 'RUNNING', scope: 'paired page-context diagnostic; not end-to-end browser performance',
  model: 'jev-1.13.0', threshold: 0.9, repeats: 3, variants: [...CONTEXT_VARIANTS],
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes, startedAt: new Date().toISOString(), budgetUsd: null, calls: 0,
  inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, costComplete: true,
  pricePerMillion: 0.042, priceCheckedDate: '2026-09-29',
  pageErrors: [], rows: [],
}
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
let browser
let server
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright')
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: true } })
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Missing local address')
  browser = await chromium.launch({ channel: 'chrome', headless: false })
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
  page.on('pageerror', error => report.pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:' + address.port, { waitUntil: 'load' })
  await page.bringToFront()
  await page.waitForFunction(() => window.__game?.state.mode === 'title', undefined, { timeout: 15000 })
  const snapshot = await page.evaluate(async () => {
    const { capturePageContext } = await import('/src/testing/page-context.ts')
    const { compactState } = await import('/src/testing/regression.ts')
    return { observation: compactState(window.__game.state), context: capturePageContext(document),
      capturedAt: new Date().toISOString() }
  })
  if (report.pageErrors.length) throw new Error('Page error during capture')
  report.snapshot = snapshot
  report.snapshotHash = hash(JSON.stringify(snapshot))
  report.screenshot = resolve(output, 'title-context.png')
  await page.screenshot({ path: report.screenshot })
  console.log('SCREENSHOT ' + report.screenshot)
  await browser.close()
  browser = null
  await server.close()
  server = null
  const requests = fixtures.map(fixture => ({
    id: fixture.id, expected: fixture.expected,
    variants: Object.fromEntries(CONTEXT_VARIANTS.map(variant => {
      const request = structuredClone(fixture.request)
      request.state.observation = structuredClone(snapshot.observation)
      return [variant, withPageContext(request, snapshot.context, variant)]
    })),
  }))
  report.requests = requests // Explicit record of what is sent. Expected remains outside each request.
  await save()
  if (live) {
    for (let repeat = 0; repeat < 3; repeat++) {
      for (let offset = 0; offset < requests.length; offset++) {
        const index = (offset + repeat) % requests.length
        const fixture = requests[index]
        for (let step = 0; step < CONTEXT_VARIANTS.length; step++) {
          // Rotate both question order and within-question evidence order.
          const variant = CONTEXT_VARIANTS[(step + repeat + index) % CONTEXT_VARIANTS.length]
          const request = fixture.variants[variant]
          report.calls++
          report.costComplete = false
          report.pending = { repeat: repeat + 1, id: fixture.id, variant }
          await save()
          const started = performance.now()
          const response = await fetch('https://api.typesafe.ai/v1/systemone', {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          })
          if (!response.ok) throw new Error('Provider HTTP ' + response.status)
          const raw = await response.json()
          const elapsedMs = performance.now() - started
          const usage = raw.usage
          if (!usage || !Number.isSafeInteger(usage.input_tokens) || usage.input_tokens < 0 || usage.input_tokens > 65536
              || !Number.isSafeInteger(usage.output_tokens) || usage.output_tokens < 0) throw new Error('Invalid usage')
          report.inputTokens += usage.input_tokens
          report.outputTokens += usage.output_tokens
          report.estimatedCostUsd += usage.input_tokens * report.pricePerMillion / 1e6
          report.costComplete = true
          if (raw.model !== report.model) throw new Error('Unexpected provider model')
          const selected = acceptRoutingAnswer(request, raw, report.threshold)
          if (selected.kind !== 'case' && !['uncertain', 'no_match'].includes(selected.reason)) {
            const answer = raw.answers?.next_case
            report.invalidAnswer = {
              selected, type: answer?.type, choice: answer?.choice, confidence: answer?.confidence,
              probabilities: answer?.probabilities, elapsedMs,
              inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
            }
            await save()
            throw new Error('Invalid answer: ' + selected.reason)
          }
          const answer = raw.answers.next_case
          const actual = selected.kind === 'case' ? selected.id : 'escalate'
          report.rows.push({
            repeat: repeat + 1, id: fixture.id, variant, expected: fixture.expected,
            choice: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities,
            selected, correct: actual === fixture.expected, elapsedMs,
            inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
          })
          report.pending = null
          await save()
        }
      }
      console.log('REPEAT ' + (repeat + 1) + ' COMPLETE')
    }
    report.summary = Object.fromEntries(CONTEXT_VARIANTS.map(variant => {
      const rows = report.rows.filter(row => row.variant === variant)
      const accepted = rows.filter(row => row.selected.kind === 'case')
      const times = rows.map(row => row.elapsedMs).sort((a, b) => a - b)
      return [variant, {
        calls: rows.length, rawCorrect: rows.filter(row => row.choice === row.expected).length,
        routedCorrect: rows.filter(row => row.correct).length, accepted: accepted.length,
        falseAutomatic: accepted.filter(row => !row.correct).length,
        unnecessaryEscalations: rows.filter(row => row.expected !== 'escalate' && row.selected.kind === 'escalate').length,
        medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * 0.95)],
        inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
        outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
      }]
    }))
    report.status = 'MEASURED'
  } else report.status = 'CAPTURED_ONLY'
} catch (error) {
  report.status = 'INCOMPLETE'
  report.error = error instanceof Error && /^(Provider HTTP|Invalid |Unexpected provider|Page error|Missing local)/.test(error.message)
    ? error.message : 'Capture, network, timeout, parsing or tool failure; no retry'
  process.exitCode = 1
} finally {
  await browser?.close()
  await server?.close()
  report.reservedCostCeilingUsd = report.calls * 65536 * report.pricePerMillion / 1e6
  await save()
  console.log('REPORT ' + resolve(output, 'report.json'))
}
