import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { routingFixtures } from '../src/testing/routing-fixtures.ts'
import { acceptRoutingAnswer } from '../src/testing/jev-routing.ts'

// Live use is authorized in this task. Default invocation remains offline.
const args = process.argv.slice(2)
if (!args.includes('--live')) {
  console.log('NOT_RUN: pass --live --suite=baseline|holdout --repeats=3 for an authorized live batch.')
  process.exit(2)
}
if (args.some(arg => arg !== '--live' && !/^--suite=(baseline|holdout)$/.test(arg) && !/^--repeats=[1-9]\d*$/.test(arg))
    || new Set(args.map(arg => arg.split('=')[0])).size !== args.length) {
  throw new Error('Invalid or duplicate batch arguments')
}
const suite = args.find(arg => arg.startsWith('--suite='))?.split('=')[1] ?? 'baseline'
const repeats = Number(args.find(arg => arg.startsWith('--repeats='))?.split('=')[1] ?? 3)
if (!Number.isSafeInteger(repeats) || repeats < 1) throw new Error('Invalid repeat count')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixtures = routingFixtures(suite)
const pricePerMillion = 0.042 // Recheck official model pricing before authorizing each live run.
const maxInputTokensPerRequest = 65536
const reservePerCall = maxInputTokensPerRequest * pricePerMillion / 1e6
const budgetUsd = null // User explicitly removed the spend ceiling for this task.
const maxCalls = fixtures.length * repeats // Finite experimental design, not an authorization ceiling.
if (!Number.isSafeInteger(maxCalls)) throw new Error('Invalid batch size')
const key = process.env.TYPESAFE_API_KEY
if (!key) {
  console.log('NOT_RUN: TYPESAFE_API_KEY must be injected locally; do not paste it into chat or a file.')
  process.exit(2)
}
const output = resolve(root, 'artifacts', 'jev', new Date().toISOString().replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const sourceHashes = {}
for (const file of ['scripts/jev-benchmark.mjs', 'src/testing/jev-routing.ts',
  'src/testing/routing-fixtures.ts', 'src/testing/regression.ts']) {
  sourceHashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')
}
const report = {
  status: 'RUNNING', scope: 'synthetic routing only; not end-to-end browser testing',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes, startedAt: new Date().toISOString(), model: 'jev-1.13.0',
  threshold: 0.9, thresholdValidated: false, suite, repeats, maxCalls, budgetUsd, pricePerMillion,
  priceSource: 'https://docs.typesafe.ai/models', priceCheckedDate: '2026-09-29',
  estimatedCostUsd: 0, costComplete: true, calls: 0, rows: [],
}
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
try {
  for (let repeat = 0; repeat < repeats; repeat++) {
    // Rotate evaluation order; no generated variants or automatic retries.
    for (let offset = 0; offset < fixtures.length; offset++) {
      const index = (offset + repeat) % fixtures.length
      const fixture = fixtures[index]
      if (report.calls >= maxCalls) {
        throw new Error('Call count exceeded experimental design')
      }
      report.calls++
      report.costComplete = false
      await save()
      const started = performance.now()
      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(fixture.request),
      })
      if (!response.ok) throw new Error('Provider HTTP ' + response.status + '; no retry')
      const raw = await response.json()
      const elapsedMs = performance.now() - started
      const usage = raw.usage
      if (!usage || !Number.isSafeInteger(usage.input_tokens) || usage.input_tokens < 0
          || usage.input_tokens > maxInputTokensPerRequest
          || !Number.isSafeInteger(usage.output_tokens) || usage.output_tokens < 0) {
        throw new Error('Invalid or missing usage; stop without assuming zero cost')
      }
      report.estimatedCostUsd += usage.input_tokens * pricePerMillion / 1e6
      report.costComplete = true
      if (raw.model !== report.model) throw new Error('Returned model does not match pinned version')
      const selected = acceptRoutingAnswer(fixture.request, raw, report.threshold)
      const actual = selected.kind === 'case' ? selected.id : 'escalate'
      const answer = raw.answers?.next_case
      const valid = selected.kind === 'case' || ['uncertain', 'no_match'].includes(selected.reason)
      const knownOptions = Object.keys(fixture.request.questions.next_case.criteria)
      report.rows.push({
        repeat: repeat + 1, fixtureIndex: index, expected: fixture.expected, selected,
        correct: actual === fixture.expected, elapsedMs,
        inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
        choice: valid ? answer.choice : null,
        confidence: valid ? answer.confidence : null,
        probabilities: valid ? Object.fromEntries(knownOptions.map(id => [id, answer.probabilities[id]])) : null,
      })
      await save()
      if (!valid) throw new Error('Malformed model decision; no retry')
    }
  }
  const accepted = report.rows.filter(row => row.selected.kind === 'case')
  const times = report.rows.map(row => row.elapsedMs).sort((a, b) => a - b)
  report.summary = {
    rawChoiceAccuracy: report.rows.filter(row => row.choice === row.expected).length / report.rows.length,
    routingAccuracy: report.rows.filter(row => row.correct).length / report.rows.length,
    acceptedCases: accepted.length, falseAutomaticRoutes: accepted.filter(row => !row.correct).length,
    unnecessaryEscalations: report.rows.filter(row => row.expected !== 'escalate' && row.selected.kind === 'escalate').length,
    acceptedAccuracy: accepted.length ? accepted.filter(row => row.correct).length / accepted.length : null,
    medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * 0.95)],
    inputTokens: report.rows.reduce((sum, row) => sum + row.inputTokens, 0),
    outputTokens: report.rows.reduce((sum, row) => sum + row.outputTokens, 0),
  }
  report.status = 'MEASURED' // Measurements do not establish a release gate or a model-quality PASS.
} catch (error) {
  report.status = 'INCOMPLETE'
  // Never serialize response bodies, headers, credentials, or arbitrary fetch errors.
  report.error = error instanceof Error && /^(Provider HTTP|Invalid or missing usage|Returned model|Malformed model|Call or reserved)/.test(error.message)
    ? error.message : 'Network, timeout, parsing, or tool failure; stopped without retry'
  process.exitCode = 1
} finally {
  report.reservedCostCeilingUsd = report.calls * reservePerCall
  await save()
  console.log('REPORT ' + resolve(output, 'report.json'))
}
