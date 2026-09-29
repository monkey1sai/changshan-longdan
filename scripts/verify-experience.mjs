import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'

// Run against a local dev server with an installed Playwright module; never fetch dependencies.
const [playwrightModule, output, url = 'http://127.0.0.1:5174/'] = process.argv.slice(2)
if (!playwrightModule || !output || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(url)) throw new Error('Provide Playwright module path, evidence directory and a localhost URL')
const { chromium } = createRequire(import.meta.url)(playwrightModule)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
const report = { url, headed: true, passed: false, skillScenarios: 'Fresh battle before guard, dash and musou; real keyboard input', checks: {}, errors }
const capture = name => page.screenshot({ path: join(output, `${name}.png`) })
const state = () => page.evaluate(() => window.__game.state)
const press = (key, ms = 80) => page.keyboard.down(key).then(() => page.waitForTimeout(ms)).then(() => page.keyboard.up(key))
try {
  await page.goto(url)
  await page.waitForFunction(() => !!window.__game, { timeout: 30000 })
  await page.bringToFront()
  report.checks.visible = await page.evaluate(() => document.visibilityState)
  assert.equal(report.checks.visible, 'visible')
  await capture('01-title')
  await page.getByRole('button', { name: '出陣', exact: true }).click()
  await page.waitForTimeout(1400)
  await press('F3')
  await capture('02-battle')
  report.checks.started = await state()
  assert.equal(report.checks.started.mode, 'playing')
  await press('w', 1400)
  report.checks.moved = await state()
  assert.ok(report.checks.moved.position[2] < report.checks.started.position[2] - 2)
  await page.keyboard.down('j')
  await page.waitForTimeout(500)
  await press('k')
  await page.waitForTimeout(600)
  await capture('03-combat')
  report.checks.combat = await state()
  await page.keyboard.up('j')
  // 技能驗收各自從開場起跑；實戰受背擊或倒地本來就不能隨時出招。
  await page.evaluate(() => window.__game.start())
  await page.keyboard.down('f')
  const guarded = await page.waitForFunction(() => window.__game.state.playerState === 'guard' && window.__game.state, null, { timeout: 2500 })
  report.checks.guard = await guarded.jsonValue()
  await capture('04-guard')
  assert.equal(report.checks.guard.playerState, 'guard')
  await page.keyboard.up('f')
  await page.evaluate(() => window.__game.start())
  await page.keyboard.down('d')
  await press('Shift', 80)
  // 被背後攻擊打斷時，必須等閃避真的開始才送普攻，不能用牆鐘猜取消時機。
  await page.waitForFunction(() => window.__game.state.playerState === 'dodge', null, { timeout: 2000 })
  await press('j')
  const dashed = await page.waitForFunction(() => window.__game.state.move === 'DASH' && window.__game.state, null, { timeout: 2500 })
  report.checks.dash = await dashed.jsonValue()
  await page.keyboard.up('d')
  await capture('05-dash')
  assert.equal(report.checks.dash.move, 'DASH')
  await page.evaluate(() => { window.__game.start(); window.__game.fillMusou() })
  await press('l')
  await page.waitForTimeout(650)
  await capture('06-musou')
  report.checks.musou = await state()
  assert.equal(report.checks.musou.dragon, true)
  await page.waitForTimeout(4500)
  report.checks.frames = await page.evaluate(() => new Promise(resolve => {
    const samples = []
    let last = performance.now()
    function frame(now) {
      samples.push(now - last); last = now
      if (samples.length < 120) requestAnimationFrame(frame)
      else {
        samples.shift(); samples.sort((a, b) => a - b)
        resolve({ count: samples.length, medianMs: samples[Math.floor(samples.length / 2)], p95Ms: samples[Math.floor(samples.length * .95)], fps: 1000 / (samples.reduce((a, b) => a + b, 0) / samples.length) })
      }
    }
    requestAnimationFrame(frame)
  }))
  await press('Escape')
  report.checks.paused = await state()
  assert.equal(report.checks.paused.mode, 'paused')
  await capture('07-pause')
  await page.getByRole('button', { name: '繼續', exact: true }).click()
  await press('r')
  await page.waitForTimeout(500)
  report.checks.recenter = await state()
  await page.setViewportSize({ width: 800, height: 600 })
  await capture('08-compact')
  report.checks.compactOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  assert.equal(report.checks.compactOverflow, false)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Deterministic fixtures use DEV hooks; kept separate from real-time keyboard/frame evidence above.
  await page.evaluate(() => { window.__game.start(); window.__game.setTimeScale(0) })
  await page.keyboard.down('f')
  await page.waitForTimeout(100)
  await page.evaluate(() => window.__game.strike(80, true))
  report.checks.scriptedParry = await state()
  assert.equal(report.checks.scriptedParry.hp, 1000)
  assert.ok(report.checks.scriptedParry.counterReady > 0)
  await capture('09-parry')
  await page.keyboard.up('f')
  await press('j')
  report.checks.scriptedCounter = await state()
  assert.equal(report.checks.scriptedCounter.move, 'COUNTER')
  await page.evaluate(() => { window.__game.setTimeScale(1); window.__game.advance(9); window.__game.setTimeScale(0) })
  await capture('10-counter')
  await page.evaluate(() => {
    window.__game.start(); window.__game.setTimeScale(1)
    window.__game.advance(14, { guard: true }); window.__game.setTimeScale(0)
    window.__game.setHp(1); window.__game.strike(26)
  })
  report.checks.scriptedLethalBlock = await state()
  assert.equal(report.checks.scriptedLethalBlock.mode, 'defeat')
  assert.equal(report.checks.scriptedLethalBlock.hp, 0)
  assert.equal(report.checks.scriptedLethalBlock.damageTaken, 1)
  await capture('11-lethal-block')
  await page.evaluate(() => { window.__game.start(); window.__game.setTimeScale(1) })
  // Playwright 預設強制頁面有焦點；關閉測試模擬才能驗證真正的失焦事件。
  const focusSession = await page.context().newCDPSession(page)
  await focusSession.send('Emulation.setFocusEmulationEnabled', { enabled: false })
  const secondPage = await page.context().newPage()
  const secondFocusSession = await page.context().newCDPSession(secondPage)
  await secondFocusSession.send('Emulation.setFocusEmulationEnabled', { enabled: false })
  await secondPage.bringToFront()
  await page.waitForTimeout(150)
  report.checks.lostFocus = await page.evaluate(() => !document.hasFocus())
  assert.equal(report.checks.lostFocus, true)
  report.checks.blurPaused = await state()
  assert.equal(report.checks.blurPaused.mode, 'paused')
  await secondPage.close()
  await page.bringToFront()
  report.checks.stayedPaused = await state()
  assert.equal(report.checks.stayedPaused.mode, 'paused')
  report.passed = true
} catch (error) {
  report.failure = error.message
  throw error
} finally {
  await writeFile(join(output, 'browser-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}
if (errors.length) process.exitCode = 1
