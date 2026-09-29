import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const [modulePath, output, url = 'http://127.0.0.1:5181/'] = process.argv.slice(2)
if (!modulePath || !output || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(url)) throw new Error('Require installed Playwright, output directory and local URL')
const { chromium } = createRequire(import.meta.url)(modulePath)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
const report = { url, headed: true, passed: false, checks: {}, errors: [] }
page.on('pageerror', (error) => report.errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()) })
const state = () => page.evaluate(() => window.__game.state)
const capture = (name) => page.screenshot({ path: join(output, `${name}.png`) })
try {
  await page.goto(url)
  await page.bringToFront()
  await page.waitForFunction(() => window.__game?.state.assets.character === 'ready', null, { timeout: 30000 })
  assert.equal(await page.evaluate(() => document.visibilityState), 'visible')
  await capture('01-title')
  for (const [index, level] of ['fortress', 'moonlit-manor', 'fortress'].entries()) {
    if (index) {
      await page.keyboard.press('p')
      await page.locator('#change-level').click()
    }
    await page.locator(`input[value="${level}"]`).check()
    await page.locator('#start').click()
    await page.waitForFunction(() => window.__game.state.mode === 'playing')
    const before = await state()
    assert.equal(before.level, level)
    assert.equal(before.alive, 300)
    assert.equal(before.assets.character, 'ready')
    await page.keyboard.down('w')
    await page.waitForTimeout(250)
    await page.keyboard.up('w')
    await page.keyboard.down('j')
    await page.waitForTimeout(1300)
    await page.keyboard.up('j')
    await capture(`0${index + 2}-${level}`)
    report.checks[`${index}-${level}`] = await state()
    assert.equal(report.checks[`${index}-${level}`].mode, 'playing')
  }
  // DEV hook supplies charge only; the ability itself is activated with a real key.
  await page.evaluate(() => window.__game.fillMusou())
  await page.keyboard.press('l')
  await page.waitForFunction(() => window.__game.state.dragon)
  await page.waitForTimeout(500)
  await capture('05-dragon')
  report.checks.dragon = await state()
  await page.waitForTimeout(4000)
  report.checks.frames = await page.evaluate(() => new Promise((resolve) => {
    const frames = []; let last = performance.now()
    function frame(now) {
      frames.push(now - last); last = now
      if (frames.length < 61) requestAnimationFrame(frame)
      else { frames.shift(); resolve({ count: frames.length, meanMs: frames.reduce((a, b) => a + b, 0) / frames.length, visible: document.visibilityState }) }
    }
    requestAnimationFrame(frame)
  }))
  assert.equal(report.checks.frames.visible, 'visible')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.failure = error.message
  process.exitCode = 1
} finally {
  await writeFile(join(output, 'assets-browser-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}
