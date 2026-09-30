import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'

// Uses installed Chrome in an isolated temporary profile, never a signed-in profile.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const phase = process.argv[2] ?? 'all'
if (!['hooks', 'input', 'all'].includes(phase)) throw new Error('Expected hooks | input | all')
const playwright = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright')
const output = resolve(root, 'artifacts', 'browser', new Date().toISOString().replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const sourceHashes = {}
for (const file of ['scripts/test-browser.mjs', 'src/testing/regression.ts', 'src/game.ts',
  'src/core/input.ts', 'src/entities/player.ts', 'src/ui/screens.ts']) {
  sourceHashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')
}
const report = {
  schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(),
  phase, sourceHashes, startedAt: new Date().toISOString(), headed: true, status: 'ERROR',
  hooks: [], input: [], pageErrors: [], consoleErrors: [], consoleWarnings: [], payloadSamples: [],
  providerCalls: 0, providerInputTokens: 0, providerOutputTokens: 0, providerCostUsd: 0,
  modelComparison: 'NOT_RUN', visualReview: 'PENDING', screenshots: [],
}
let server
let browser
const started = performance.now()
try {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: true } })
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Missing local server address')
  const url = 'http://127.0.0.1:' + address.port + '/'
  report.url = url
  browser = await playwright.chromium.launch({ channel: 'chrome', headless: false })
  report.browserVersion = browser.version()
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => report.pageErrors.push(e.message))
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(message.text())
    if (message.type() === 'warning' && report.consoleWarnings.length < 100) report.consoleWarnings.push(message.text())
  })
  const screenshot = async name => {
    const path = resolve(output, name + '.png')
    await page.screenshot({ path })
    report.screenshots.push(path)
    console.log('SCREENSHOT ' + path)
  }
  const load = async () => {
    await page.goto(url, { waitUntil: 'load' })
    await page.bringToFront()
    await page.waitForFunction(() => window.__game?.state.mode === 'title')
  }
  if (phase !== 'input') {
    // Repeated runs detect incidental instability; they are not model comparisons.
    for (let repeat = 0; repeat < 3; repeat++) {
      await load()
      const sample = await page.evaluate(async () => {
        const { compactState } = await import('/src/testing/regression.ts')
        return {
          fullState: JSON.stringify(window.__game.state),
          compactState: JSON.stringify(compactState(window.__game.state)),
          pageText: document.body.innerText,
        }
      })
      report.payloadSamples.push({
        fullStateBytes: Buffer.byteLength(sample.fullState),
        compactStateBytes: Buffer.byteLength(sample.compactState),
        pageTextBytes: Buffer.byteLength(sample.pageText),
        tokens: null, note: 'UTF-8 bytes only; not tokenizer usage or equivalent visual evidence',
      })
      const results = await page.evaluate(async () => {
        const { CASE_IDS, runCase } = await import('/src/testing/regression.ts')
        const hidden = id => {
          const element = document.getElementById(id)
          if (!element) throw new Error('Missing DOM #' + id)
          return element.hidden
        }
        return CASE_IDS.map(id => runCase(id, window.__game, hidden))
      })
      report.hooks.push({ repeat: repeat + 1, results })
      console.log('HOOKS ' + (repeat + 1) + ' ' + results.map(r => r.id + ':' + r.status).join(' '))
      const failed = results.filter(r => r.status !== 'PASS')
      if (failed.length) {
        await screenshot('hook-failure')
        throw new Error(JSON.stringify(failed))
      }
    }
  }
  if (phase !== 'hooks') {
    await load()
    await screenshot('01-title')
    // Observe real rAF state transitions rather than inject synthetic keyboard events.
    await page.evaluate(() => {
      window.__observed = []
      let previous = ''
      const observe = () => {
        const s = window.__game.state
        const key = JSON.stringify([s.mode, s.playerState, s.move])
        if (key !== previous) {
          window.__observed.push({ mode: s.mode, playerState: s.playerState, move: s.move })
          if (window.__observed.length > 600) window.__observed.shift()
          previous = key
        }
        window.__observerFrame = requestAnimationFrame(observe)
      }
      observe()
    })
    await page.locator('#start').click()
    await page.waitForFunction(() => window.__game.state.mode === 'playing')
    assert.equal(await page.locator('#title').isVisible(), false)
    assert.equal(await page.locator('#hud').isVisible(), true)
    report.input.push({ id: 'start', status: 'PASS', operation: 'mouse click #start' })
    await screenshot('02-playing')
    // Clear button focus through a real canvas click; the game intentionally ignores keys on buttons.
    await page.locator('#scene').click({ position: { x: 500, y: 450 } })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => window.__game.state.mode === 'paused')
    assert.equal(await page.locator('#pause').isVisible(), true)
    await screenshot('03-paused')
    await page.locator('#resume').click()
    await page.waitForFunction(() => window.__game.state.mode === 'playing')
    assert.equal(await page.locator('#pause').isVisible(), false)
    report.input.push({ id: 'pause', status: 'PASS', operation: 'Escape then mouse click #resume' })
    await page.locator('#scene').click({ position: { x: 500, y: 450 } })
    await page.waitForFunction(() => window.__game.state.playerState === 'move')
    await page.evaluate(() => { window.__observed.length = 0 })
    await page.keyboard.press('j')
    await page.waitForFunction(() => window.__observed.some(s => s.move === 'N1'))
    report.input.push({ id: 'attack', status: 'PASS', operation: 'physical j key via browser protocol' })
    await page.waitForFunction(() => window.__game.state.playerState === 'move')
    await page.keyboard.down('f')
    await page.waitForFunction(() => window.__game.state.playerState === 'guard')
    await screenshot('04-guard')
    await page.keyboard.up('f')
    report.input.push({ id: 'guard', status: 'PASS', operation: 'physical f hold; damage checked separately by hooks' })
    await page.waitForFunction(() => window.__game.state.playerState === 'move')
    await page.evaluate(() => { window.__game.fillMusou(); window.__observed.length = 0 })
    await page.keyboard.press('l')
    await page.waitForFunction(() => window.__observed.some(s => s.playerState === 'musou'))
    await screenshot('05-musou')
    report.input.push({ id: 'musou', status: 'PASS', operation: 'fillMusou setup then physical l' })
    await page.waitForFunction(() => window.__game.state.playerState === 'move')
    await page.evaluate(() => { window.__game.start(); window.__game.setHp(1); window.__game.strike(80) })
    await page.waitForFunction(() => window.__game.state.mode === 'defeat')
    await page.locator('#result').waitFor({ state: 'visible' })
    await screenshot('06-defeat')
    await page.locator('#retry').click()
    await page.waitForFunction(() => window.__game.state.mode === 'playing')
    assert.equal(await page.locator('#result').isVisible(), false)
    report.input.push({ id: 'defeat', status: 'PASS', operation: 'lethal hook setup, real-time result then mouse #retry' })
    report.frameSample = await page.evaluate(() => new Promise((resolve, reject) => {
      const times = []
      let previous = performance.now()
      let visible = !document.hidden
      let frameId
      const timeout = setTimeout(() => {
        cancelAnimationFrame(frameId)
        reject(new Error('Frame sample timed out; keep Chrome visible'))
      }, 5000)
      const frame = now => {
        times.push(now - previous)
        previous = now
        visible = visible && !document.hidden
        if (times.length < 120) frameId = requestAnimationFrame(frame)
        else {
          clearTimeout(timeout)
          const sorted = times.slice(1).sort((a, b) => a - b)
          resolve({ visible, frames: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)],
            p95Ms: sorted[Math.floor(sorted.length * 0.95)], quality: window.__game.state.quality,
            note: 'Single local rAF sample, not a performance improvement or human feel verdict' })
        }
      }
      frameId = requestAnimationFrame(frame)
    }))
    report.transitions = await page.evaluate(() => window.__observed)
    await page.evaluate(() => cancelAnimationFrame(window.__observerFrame))
    assert.equal(report.frameSample.visible, true)
  }
  assert.deepEqual(report.pageErrors, [])
  assert.deepEqual(report.consoleErrors, [])
  report.status = 'PASS'
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
  console.error(report.error)
} finally {
  report.elapsedMs = performance.now() - started
  await browser?.close()
  await server?.close()
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log('REPORT ' + resolve(output, 'report.json'))
}
