import { readMapPixels } from '../../src/testing/player-loop.ts'

/** Read painted UI, visible text and rendered minimap pixels only. */
export async function observe(page, documentId) {
  const observed = await page.evaluate(({ id, pixelParser }) => {
    // Trusted, locally tested pure image parser; never model-generated code.
    const parsePixels = new Function('return (' + pixelParser + ')')()
    const visible = el => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false
      for (let p = el; p; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (p.hidden || s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) < 0.05) return false
      }
      return true
    }
    const isVisible = id => visible(document.getElementById(id))
    const text = id => isVisible(id) ? document.getElementById(id).innerText.trim() : ''
    const paused = isVisible('pause'), title = isVisible('title'), result = isVisible('result')
    const resultTitle = result ? text('result-title') : ''
    const mode = title ? 'title' : paused ? 'paused' : result
      ? /完全勝利|Complete Victory/.test(resultTitle) ? 'victory' : /敗走|Has Fallen/.test(resultTitle) ? 'defeat' : 'unknown'
      : isVisible('hud') ? 'playing' : 'unknown'
    const scope = mode === 'playing' ? document.getElementById('hud') : document.getElementById(title ? 'title' : paused ? 'pause' : 'result')
    const words = []
    if (scope) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim() || !visible(node.parentElement)) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const r = range.getBoundingClientRect()
        if (r.bottom > 0 && r.top < innerHeight && r.left < innerWidth && r.right > 0) words.push(node.textContent.trim())
      }
    }
    const controls = [...document.querySelectorAll('button[id]')].filter(el => {
      if (!visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false
      const r = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
    }).map(el => ({ id: el.id, name: el.innerText.trim() }))
    const hudReadable = mode === 'playing'
    const number = id => { const s = text(id); return /^\d+$/.test(s) ? Number(s) : null }
    const bar = document.getElementById('hp-fill'), parent = bar?.parentElement
    const hpRatio = hudReadable && visible(parent) ? Math.max(0, Math.min(1, bar.getBoundingClientRect().width / parent.getBoundingClientRect().width)) : null
    const canvas = document.getElementById('minimap')
    const map = hudReadable && visible(canvas)
      ? parsePixels(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
      : { player: null, targets: [] }
    return {
      documentId: id, mode, focused: document.hasFocus() && document.visibilityState === 'visible',
      controls, text: words.join('\n'), ko: hudReadable ? number('ko') : null,
      remaining: hudReadable ? number('remain') : null, hpRatio,
      musouReady: hudReadable && isVisible('musou-prompt'),
      moveName: hudReadable ? text('move-name') : '', moveHint: hudReadable ? text('move-hint') : '',
      resultText: result ? text('result-stats') : '', map,
    }
  }, { id: documentId, pixelParser: readMapPixels.toString() })
  const rest = observed
  if (rest.mode === 'victory' || rest.mode === 'defeat') {
    const ko = rest.resultText.match(/(?:擊破數|KOs)\s*(\d+)/)
    rest.ko = ko ? Number(ko[1]) : null
  }
  return rest
}

export async function execute(page, action) {
  if (action.kind === 'click') {
    const target = page.locator('[id=' + JSON.stringify(action.controlId) + ']')
    if (!await target.isVisible() || !await target.isEnabled()) throw new Error('Stale UI target')
    await target.click()
  } else if (action.kind === 'keys') {
    // A real canvas click removes button focus and may perform a normal attack.
    const focusOnControl = await page.evaluate(() => !!document.activeElement?.closest('button,select,input,textarea'))
    if (focusOnControl) await page.locator('#scene').click({ position: { x: 550, y: 350 } })
    const held = []
    try {
      for (const key of action.keys) { await page.keyboard.down(key); held.push(key) }
      if (action.repeatKey) {
        const until = performance.now() + action.holdMs
        while (performance.now() < until) {
          await page.keyboard.down(action.repeatKey)
          await page.waitForTimeout(70)
          await page.keyboard.up(action.repeatKey)
          await page.waitForTimeout(110)
        }
      } else await page.waitForTimeout(action.holdMs)
      return await action.observeHeld?.()
    } finally {
      if (action.repeatKey) await page.keyboard.up(action.repeatKey)
      for (const key of held.reverse()) await page.keyboard.up(key)
      if (action.settleMs) await page.waitForTimeout(action.settleMs)
    }
  }
  if (action.settleMs) await page.waitForTimeout(action.settleMs)
}

export async function readTitleHints(page, capture) {
  const segments = []
  for (let i = 0; i < 3; i++) {
    const observation = await capture()
    if (observation.mode !== 'title') break
    segments.push(observation.text)
    await page.mouse.move(650, 600)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(120)
  }
  await page.locator('#start').scrollIntoViewIfNeeded()
  return [...new Set(segments)].join('\n')
}
