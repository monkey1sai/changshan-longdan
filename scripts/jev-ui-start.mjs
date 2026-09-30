import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { buildUiActionRequest, acceptUiAction } from '../src/testing/ui-actions.ts'

if (process.argv.length !== 3 || process.argv[2] !== '--live') {
  console.log('NOT_RUN: explicit authorized --live invocation required')
  process.exit(2)
}
const key = process.env.TYPESAFE_API_KEY
if (!key) throw new Error('Credential unavailable')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'artifacts', 'jev-ui', new Date().toISOString().replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const report = {
  status: 'RUNNING', scope: 'live current-DOM action then independent DOM outcome verification',
  goal: '按出陣後，應該看得到血條與三百名敵軍', threshold: 0.9,
  calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, costComplete: true,
  pageErrors: [], rows: [], sourceHashes: {},
}
for (const file of ['scripts/jev-ui-start.mjs', 'src/testing/ui-actions.ts', 'index.html']) {
  report.sourceHashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')
}
let server
let browser
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright')
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: true } })
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Missing local server')
  browser = await chromium.launch({ channel: 'chrome', headless: false })
  report.browserVersion = browser.version()
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => report.pageErrors.push(error.message))
  let documentId = 0
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) documentId++ })
  const capture = () => page.evaluate(id => {
    const controls = []
    for (const el of document.querySelectorAll('button[id], select[id]')) {
      const rect = el.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const style = getComputedStyle(el)
      const top = document.elementFromPoint(x, y)
      if (!rect.width || !rect.height || style.visibility !== 'visible' || style.display === 'none'
          || Number(style.opacity) === 0 || !top || !el.contains(top)) continue
      const name = el.getAttribute('aria-label') || (el.tagName === 'SELECT'
        ? el.closest('label')?.querySelector('span')?.textContent : el.textContent) || el.id
      controls.push({
        id: el.id, role: el.tagName === 'SELECT' ? 'select' : 'button',
        name: name.trim(), enabled: !el.disabled && el.getAttribute('aria-disabled') !== 'true',
        ...(el.tagName === 'SELECT' ? { options: [...el.options].map(option => ({
          value: option.value, label: option.text, selected: option.selected, disabled: option.disabled,
        })) } : {}),
      })
    }
    return { documentId: String(id), controls, renderedText: document.body.innerText }
  }, documentId)
  for (let repeat = 1; repeat <= 3; repeat++) {
    await page.goto('http://127.0.0.1:' + address.port, { waitUntil: 'load' })
    await page.bringToFront()
    await page.locator('#start').waitFor({ state: 'visible' })
    const before = await capture()
    const plan = buildUiActionRequest(report.goal, before)
    // The model receives no game-internal state and cannot create executor actions.
    const row = { repeat, before, request: plan.request, actions: plan.actions, status: 'PENDING' }
    report.rows.push(row)
    await page.screenshot({ path: resolve(output, repeat + '-before.png') })
    const started = performance.now()
    report.calls++
    report.costComplete = false
    await save()
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(plan.request),
    })
    if (!response.ok) throw new Error('Provider HTTP ' + response.status)
    const raw = await response.json()
    row.modelMs = performance.now() - started
    const usage = raw.usage
    if (!usage || !Number.isSafeInteger(usage.input_tokens) || usage.input_tokens < 0 || usage.input_tokens > 65536
        || !Number.isSafeInteger(usage.output_tokens) || usage.output_tokens < 0) throw new Error('Invalid usage')
    report.inputTokens += usage.input_tokens
    report.outputTokens += usage.output_tokens
    report.estimatedCostUsd += usage.input_tokens * 0.042 / 1e6
    report.costComplete = true
    row.usage = usage
    row.answer = raw.answers?.next_action
    const current = await capture()
    const action = acceptUiAction(plan, raw, current, report.threshold)
    row.selectedAction = action
    await save()
    if (!action) throw new Error('No validated current-page action')
    // Resolve only the DOM ID from the observed action registry, never model-produced code.
    const target = page.locator('[id=' + JSON.stringify(action.controlId) + ']')
    assert.equal(await target.isVisible(), true)
    assert.equal(await target.isEnabled(), true)
    if (action.kind === 'click') await target.click()
    else await target.selectOption(action.value)
    row.afterAction = await capture()
    await page.locator('#hud').waitFor({ state: 'visible' })
    const outcome = await page.evaluate(() => {
      const visible = id => {
        const el = document.getElementById(id)
        return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible'
      }
      const fill = document.getElementById('hp-fill')
      return {
        titleVisible: visible('title'), hudVisible: visible('hud'), hpVisible: visible('hp-fill'),
        hpBarRatio: fill && fill.parentElement ? fill.getBoundingClientRect().width / fill.parentElement.getBoundingClientRect().width : 0,
        remaining: document.getElementById('remain')?.textContent?.trim(),
      }
    })
    row.outcome = outcome
    row.after = await capture()
    assert.equal(outcome.titleVisible, false)
    assert.equal(outcome.hudVisible, true)
    assert.equal(outcome.hpVisible, true)
    assert.ok(outcome.hpBarRatio > 0.95 && outcome.hpBarRatio <= 1.01)
    assert.equal(outcome.remaining, '300')
    assert.ok(!row.after.controls.some(control => control.id === 'start'))
    assert.ok(!row.after.controls.some(control => control.id === 'resume' || control.id === 'retry'))
    row.screenshot = resolve(output, repeat + '-after.png')
    await page.screenshot({ path: row.screenshot })
    row.decisionAndVerificationMs = performance.now() - started
    row.status = 'PASS'
    await save()
    console.log('REPEAT ' + repeat + ' PASS ' + JSON.stringify({ action, confidence: row.answer.confidence }))
    console.log('SCREENSHOT ' + row.screenshot)
  }
  assert.deepEqual(report.pageErrors, [])
  report.status = 'PASS'
} catch (error) {
  report.status = 'INCOMPLETE'
  report.error = error instanceof Error && /^(Provider HTTP|Invalid usage|No validated|Missing local)/.test(error.message)
    ? error.message : 'UI execution, assertion, network, or tool failure; no retry'
  process.exitCode = 1
} finally {
  await browser?.close()
  await server?.close()
  await save()
  console.log('REPORT ' + resolve(output, 'report.json'))
}
