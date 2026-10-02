/** Headed, legal-input acceptance. No __game mutations/advance/forced wins.
 * Pass --playwright-module <existing playwright/package.json> when not installed
 * in this checkout. Evidence must be outside the repository. */
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1])
const evidence = path.resolve(args.get('--evidence') ?? '')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedAsset = JSON.parse(await readFile(path.join(root, 'public/models/zhaoyun.manifest.json'), 'utf8')).id
if (!args.has('--evidence') || evidence === root || evidence.startsWith(root + path.sep)) throw new Error('Evidence must be outside the repository')
const url = args.get('--url') ?? 'http://127.0.0.1:5180/'
const parsed = new URL(url)
if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('This local runner only accepts loopback HTTP')
const require = createRequire(args.get('--playwright-module') ?? import.meta.url)
const { chromium } = require('playwright')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--window-size=1500,1020', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] })
const consoleMessages = [], steps = []
let currentPage, currentContext, currentVideo, began
async function save(name, value) { await writeFile(path.join(evidence, name), JSON.stringify(value, null, 2)) }
async function context(label) {
  currentContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    recordVideo: { dir: evidence, size: { width: 1440, height: 900 } } })
  currentPage = await currentContext.newPage(); currentVideo = currentPage.video()
  currentPage.on('console', m => consoleMessages.push({ label, at: Date.now(), type: m.type(), text: m.text() }))
  currentPage.on('pageerror', e => consoleMessages.push({ label, at: Date.now(), type: 'pageerror', text: e.message }))
  currentPage.on('requestfailed', r => consoleMessages.push({ label, at: Date.now(), type: 'requestfailed', url: r.url(), failure: r.failure() }))
  await currentPage.goto(url); await currentPage.bringToFront()
  await currentPage.waitForFunction(() => !!window.__game?.state.character && window.__game.state.character.state !== 'loading')
  const state = await currentPage.evaluate(() => window.__game.state)
  if (state.character?.state !== 'ready' || state.character.id !== expectedAsset) throw new Error('New asset is not ready: ' + JSON.stringify(state.character))
  began = Date.now()
  await currentPage.evaluate(label => {
    window.__qa = { label, begin: performance.now(), marker: 'loaded', frames: [] }
    const tag = document.createElement('div'); tag.id = 'qa-recording'
    Object.assign(tag.style, { position: 'fixed', top: '2px', left: '35%', zIndex: '100', color: '#fff', background: '#0009', padding: '3px', font: '12px monospace', pointerEvents: 'none' })
    document.body.appendChild(tag)
    const observe = () => {
      const t = (performance.now() - window.__qa.begin) / 1000
      const state = window.__game.state
      window.__qa.frames.push({ t, marker: window.__qa.marker, visible: document.visibilityState, focused: document.hasFocus(), ...state })
      tag.textContent = `QA ${label} ${t.toFixed(2)}s ${window.__qa.marker}`
      requestAnimationFrame(observe)
    }
    requestAnimationFrame(observe)
  }, label)
  return currentPage
}
async function mark(name) {
  await currentPage.evaluate(name => { window.__qa.marker = name }, name)
  const state = await currentPage.evaluate(() => window.__game.state)
  steps.push({ t: (Date.now() - began) / 1000, name, state })
  console.log(JSON.stringify({ checkpoint: name, hp: state.hp, ko: state.ko, state: state.playerState, move: state.move, musou: state.musou }))
}
async function press(key) { await currentPage.keyboard.press(key, { delay: 25 }) }
async function hold(key, ms) { await currentPage.keyboard.down(key); await currentPage.waitForTimeout(ms); await currentPage.keyboard.up(key) }
async function shot(name) { await currentPage.screenshot({ path: path.join(evidence, name + '.png') }) }
async function close(label) {
  const frames = await currentPage.evaluate(() => window.__qa.frames)
  await save(label + '-telemetry.json', frames)
  await save(label + '-steps.json', steps.splice(0))
  if (label !== 'incomplete' && frames.some(f => f.character.state !== 'ready' || f.character.id !== expectedAsset)) throw new Error('A recorded frame used a failed or different character')
  if (label === 'play') {
    for (const state of ['jump', 'dodge', 'musou', 'guard', 'hurt', 'down', 'dead']) {
      if (!frames.some(f => f.playerState === state)) throw new Error('Gameplay coverage missing: ' + state)
    }
  }
  if (label === 'details') {
    for (const move of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'C1', 'C2']) {
      if (!frames.some(f => f.move === move)) throw new Error('Detailed move coverage missing: ' + move)
    }
    if (!frames.some((f, i) => i > 0 && f.playerState === 'dodge' && frames[i - 1].move === 'C2')) throw new Error('No legal C2 to dodge transition was recorded')
  }
  if (label === 'transition') {
    if (!frames.some(f => f.marker === 'clear-run-jump-land-continue' && f.playerState === 'jump')
      || !frames.some(f => f.marker === 'clear-run-jump-land-continue' && f.playerEvents.includes('land'))) throw new Error('No uninterrupted run/jump/land was recorded')
    if (!frames.some(f => f.move === 'N6')) throw new Error('Direct running attack did not reach N6')
  }
  await currentContext.close(); await currentVideo.saveAs(path.join(evidence, label + '.webm'))
  currentContext = null
}
try {
  if (args.get('--case') === 'transition') {
    await context('transition'); await press('Enter'); await currentPage.mouse.wheel(0, -5500); await currentPage.waitForTimeout(600)
    await mark('clear-run-jump-land-continue'); await currentPage.keyboard.down('d'); await currentPage.waitForTimeout(700)
    await press('Space'); await currentPage.waitForTimeout(1200); await currentPage.keyboard.up('d'); await currentPage.waitForTimeout(300)
    await mark('direct-run-normal-combo'); await currentPage.keyboard.down('a'); await currentPage.waitForTimeout(750)
    await currentPage.keyboard.down('j'); await currentPage.waitForTimeout(45); await currentPage.keyboard.up('a')
    await currentPage.waitForTimeout(2250); await currentPage.keyboard.up('j'); await currentPage.waitForTimeout(900)
    await shot('direct-run-combo-end')
    await mark('front-angle-guard'); await currentPage.keyboard.down('f'); await hold('e', 1500); await currentPage.waitForTimeout(300)
    await shot('front-rig'); await currentPage.keyboard.up('f'); await close('transition')
  } else {
  if (args.get('--case') !== 'details') {
  let page = await context('performance')
  await page.waitForTimeout(18000)
  await mark('300-enemy-title')
  const perf = await page.evaluate(async () => {
    const frames = []
    return await new Promise(resolve => {
      const start = performance.now(); let previous = start
      const observe = t => {
        frames.push(t - previous); previous = t
        if (t - start >= 12000) resolve({ frames, state: window.__game.state, visible: document.visibilityState, focused: document.hasFocus(), viewport: [innerWidth, innerHeight], ua: navigator.userAgent })
        else requestAnimationFrame(observe)
      }
      requestAnimationFrame(observe)
    })
  })
  const times = perf.frames.slice(1).sort((a, b) => a - b)
  perf.fps = 1000 / (times.reduce((a, b) => a + b, 0) / times.length)
  perf.p95 = times[Math.floor(times.length * .95)]
  await save('performance.json', perf); await shot('performance'); await close('performance')

  page = await context('play')
  await mark('idle-run-turn-stop'); await press('Enter'); await page.waitForTimeout(600)
  await page.keyboard.down('w'); await page.waitForTimeout(900); await hold('d', 550); await page.keyboard.up('w'); await page.waitForTimeout(350)
  await shot('run-stop')
  await mark('combat-combo'); await hold('j', 4200); await page.waitForTimeout(1200); await shot('combo')
  if ((await page.evaluate(() => window.__game.state.musou)) < 100) { await hold('j', 2200); await page.waitForTimeout(1000) }
  await mark('natural-musou'); await press('l'); await page.waitForTimeout(5700); await shot('musou-end')
  await mark('clear-space-mouse-combo-charge')
  await page.mouse.move(720, 470); await page.mouse.down({ button: 'left' }); await page.waitForTimeout(2300)
  await page.mouse.up({ button: 'left' }); await page.waitForTimeout(1500)
  await page.mouse.click(720, 470, { button: 'right' }); await page.waitForTimeout(1100)
  await press('j'); await page.waitForTimeout(130); await press('k'); await page.waitForTimeout(1100); await shot('charge')
  await mark('rapid-input-and-legal-cancel')
  for (let i = 0; i < 7; i++) { await press('j'); await page.waitForTimeout(55) }
  await page.waitForTimeout(400); await press('ShiftLeft'); await page.waitForTimeout(700)
  await mark('run-jump-land-run'); await page.keyboard.down('w'); await page.waitForTimeout(300); await press('Space')
  await page.waitForTimeout(450); await shot('jump'); await page.waitForTimeout(950); await page.keyboard.up('w'); await page.waitForTimeout(300)
  // Face the visible crowd ahead before guarding; do not count a stance as a block.
  await mark('guard-block-parry-and-recovery'); await hold('w', 350); await hold('f', 2000)
  for (let i = 0; i < 6; i++) { await hold('f', 240); await page.waitForTimeout(160) }
  await shot('guard')
  await mark('natural-damage-down-death')
  await page.waitForFunction(() => window.__game.state.mode === 'defeat', null, { timeout: 140000 })
  await page.waitForTimeout(2500); await shot('natural-defeat')
  await mark('restart'); await press('Enter'); await page.waitForTimeout(1000)
  const restart = await page.evaluate(() => window.__game.state)
  if (restart.mode !== 'playing' || restart.character.state !== 'ready' || restart.hp !== 1000) throw new Error('Restart failed: ' + JSON.stringify(restart))
  await hold('d', 700); await press('j'); await page.waitForTimeout(600); await shot('restart-model')
  await mark('finished'); await close('play')
  }
  // A fresh real battle keeps the hero visible while checking attacks in space.
  // Moving away from the crowd is a legal player action, not an AI/test bypass.
  const page = await context('details')
  await press('Enter'); await page.mouse.wheel(0, -5500); await page.waitForTimeout(300)
  await mark('visible-full-combo'); await hold('j', 2250); await page.waitForTimeout(900)
  await shot('detail-combo-end')
  await mark('retreat-for-clear-view'); await hold('s', 2000); await page.waitForTimeout(300)
  await mark('mouse-charge-C1'); await page.mouse.click(720, 470, { button: 'right' }); await page.waitForTimeout(1000)
  await mark('normal-to-C2-cancel'); await page.mouse.click(720, 470); await page.waitForTimeout(125)
  await page.mouse.click(720, 470, { button: 'right' })
  await page.waitForFunction(() => window.__game.state.move === 'C2' && window.__game.state.moveTime >= .55, null, { timeout: 2500 })
  await press('ShiftLeft'); await page.waitForTimeout(650); await shot('detail-cancel')
  await mark('same-N1-restart'); await press('j'); await page.waitForTimeout(650); await press('j'); await page.waitForTimeout(650)
  await mark('clear-run-jump-land'); await page.keyboard.down('d'); await page.waitForTimeout(300); await press('Space')
  await page.waitForTimeout(1000); await page.keyboard.up('d'); await page.waitForTimeout(350); await shot('detail-land')
  await close('details')

  await context('front-guard'); await press('Enter'); await mark('face-crowd-guard')
  await hold('f', 6500); await shot('front-guard')
  const blocked = await currentPage.evaluate(() => window.__qa.frames.some(f => f.playerEvents.includes('guardBlock')))
  if (!blocked) throw new Error('No ordinary guardBlock occurred during legal front guard; stance alone is not a pass')
  await mark('guard-block-confirmed'); await close('front-guard')
  }
} catch (error) {
  await save('runner-error.json', { message: error.message, stack: error.stack })
  if (currentContext) { await shot('runner-error'); await close('incomplete') }
  process.exitCode = 1
} finally {
  await save('console.json', consoleMessages); await browser.close()
}
