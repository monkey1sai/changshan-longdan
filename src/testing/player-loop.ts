export type Mode = 'title' | 'playing' | 'paused' | 'victory' | 'defeat' | 'unknown'
export interface Point { x: number; y: number }
export interface Observation {
  documentId: number
  mode: Mode
  focused: boolean
  controls: { id: string; name: string }[]
  text: string
  ko: number | null
  remaining: number | null
  hpRatio: number | null
  musouReady: boolean
  moveName: string
  moveHint: string
  resultText: string
  map: { player: Point | null; targets: Point[] }
}
export interface Condition {
  field: 'mode' | 'ko' | 'remaining' | 'hpRatio' | 'musouReady' | 'moveName' | 'moveHint' | 'resultText'
  op: 'eq' | 'gte' | 'lte' | 'contains'
  value: string | number | boolean
}
export interface Stage { id: string; goal: string; until: Condition[]; allowed?: string[] }
export interface Scenario {
  id: string
  goal: string
  maxSteps: number
  maxDurationMs: number
  noProgressMs: number
  confidenceThreshold: number
  stages: Stage[]
}
export interface Action {
  id: string
  description: string
  kind: 'click' | 'keys' | 'wait'
  controlId?: string
  keys?: string[]
  repeatKey?: string
  holdMs: number
  settleMs: number
}
export interface Navigation { forward: Point | null; right: Point | null; blocked: number }
export function matches(o: Observation, c: Condition): boolean {
  const actual = o[c.field]
  if (actual === null || actual === undefined) return false
  if (c.op === 'eq') return actual === c.value
  if (c.op === 'contains') return typeof actual === 'string' && typeof c.value === 'string' && actual.includes(c.value)
  if (typeof actual !== 'number' || typeof c.value !== 'number') return false
  return c.op === 'gte' ? actual >= c.value : actual <= c.value
}
export function stageComplete(o: Observation, stage: Stage): boolean {
  return stage.until.length > 0 && stage.until.every(c => matches(o, c))
}
export function validateScenario(raw: unknown): Scenario {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid scenario')
  const s = raw as Scenario
  if (typeof s.id !== 'string' || !/^[a-z0-9-]+$/.test(s.id) || typeof s.goal !== 'string'
      || !Number.isSafeInteger(s.maxSteps) || s.maxSteps < 1
      || !Number.isSafeInteger(s.maxDurationMs) || s.maxDurationMs < 1000
      || !Number.isSafeInteger(s.noProgressMs) || s.noProgressMs < 1000
      || !Number.isFinite(s.confidenceThreshold) || s.confidenceThreshold < 0 || s.confidenceThreshold > 1
      || !Array.isArray(s.stages) || !s.stages.length) throw new Error('Invalid scenario limits')
  const fields = ['mode', 'ko', 'remaining', 'hpRatio', 'musouReady', 'moveName', 'moveHint', 'resultText']
  const ids = new Set<string>()
  for (const stage of s.stages) {
    if (!stage || typeof stage.id !== 'string' || ids.has(stage.id) || typeof stage.goal !== 'string'
        || !Array.isArray(stage.until) || !stage.until.length
        || (stage.allowed !== undefined && (!Array.isArray(stage.allowed) || stage.allowed.some(id => typeof id !== 'string')))) throw new Error('Invalid stage')
    ids.add(stage.id)
    for (const c of stage.until) {
      if (!c || !fields.includes(c.field) || !['eq', 'gte', 'lte', 'contains'].includes(c.op)
          || !['string', 'number', 'boolean'].includes(typeof c.value)
          || (typeof c.value === 'number' && !Number.isFinite(c.value))
          || ((c.op === 'gte' || c.op === 'lte') && typeof c.value !== 'number')
          || (c.op === 'contains' && typeof c.value !== 'string')) throw new Error('Invalid condition')
    }
  }
  return s
}
/** Recognize the actual painted minimap, never entity data. */
export function readMapPixels(data: ArrayLike<number>, width: number, height: number) {
  const player: Point[] = []
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
    if (g > 230 && r > 95 && r < 180 && b > 145 && b < 215) player.push({ x, y })
    if ((r > 155 && r > g * 1.6 && r > b * 1.5)
        || (r > 240 && g > 180 && g < 225 && b > 65 && b < 125)) mask[y * width + x] = 1
  }
  const targets: Point[] = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start]) continue
    mask[start] = 0
    const queue = [start]
    let sx = 0, sy = 0
    for (let j = 0; j < queue.length; j++) {
      const index = queue[j]!, x = index % width, y = Math.floor(index / width)
      sx += x; sy += y
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx! < 0 || ny! < 0 || nx! >= width || ny! >= height) continue
        const next = ny! * width + nx!
        if (mask[next]) { mask[next] = 0; queue.push(next) }
      }
    }
    if (queue.length >= 2) targets.push({ x: sx / queue.length, y: sy / queue.length })
  }
  return {
    player: player.length ? { x: player.reduce((s, p) => s + p.x, 0) / player.length, y: player.reduce((s, p) => s + p.y, 0) / player.length } : null,
    targets,
  }
}
export function nearest(o: Observation) {
  const player = o.map.player
  if (!player) return null
  return o.map.targets.map(target => ({
    dx: target.x - player.x, dy: target.y - player.y,
    distance: Math.hypot(target.x - player.x, target.y - player.y),
  })).sort((a, b) => a.distance - b.distance)[0] ?? null
}
export function offers(o: Observation, hints: string, nav: Navigation, stage: Stage): Action[] {
  const all: Action[] = o.controls.map(control => ({
    id: 'click_' + control.id, description: 'Click visible button ' + control.name,
    kind: 'click', controlId: control.id, holdMs: 0, settleMs: 150,
  }))
  if (o.mode === 'playing' && o.focused) {
    if (o.ko === 300 && o.remaining === 0) all.push({
      id: 'wait_result', description: 'All 300 enemies are visibly defeated; release input and wait briefly for the result screen transition',
      kind: 'wait', holdMs: 0, settleMs: 350,
    })
    const add = (id: string, description: string, keys: string[], holdMs: number, settleMs = 100) =>
      all.push({ id, description, kind: 'keys', keys, holdMs, settleMs })
    const known = hints + '\n' + o.text
    if (/\bJ\b/.test(known)) add('attack', 'Hold J for normal attack combo; useful when map enemies are close', ['KeyJ'], 3000)
    if (/\bK\b/.test(known)) add('charge', 'Press K for the charge branch shown by the move guide', ['KeyK'], 100, 1300)
    if (/\bF\b/.test(known)) add('guard', 'Hold F for frontal guard; does not defeat enemies', ['KeyF'], 600, 0)
    if (/Esc/.test(known)) add('pause', 'Press Escape to pause the battle', ['Escape'], 60, 150)
    if (/\bL\b/.test(known) && o.musouReady) {
      all.push({ id: 'musou', description: 'Hold normal attack and repeatedly tap L briefly to activate visibly READY Longdan Frenzy; prefer over normal attacks near enemies', kind: 'keys', keys: ['KeyJ'], repeatKey: 'KeyL', holdMs: 1000, settleMs: 100 })
    }
    if (/WASD/.test(known)) {
      if (!nav.forward) add('calibrate_forward', 'Briefly hold W and observe minimap displacement to learn current camera-relative forward', ['KeyW'], 600)
      else if (!nav.right) add('calibrate_right', 'Briefly hold D and observe minimap displacement to learn current camera-relative right', ['KeyD'], 600)
      else {
        const target = nearest(o)
        if (target) {
          const forward = target.dx * nav.forward.x + target.dy * nav.forward.y
          const right = target.dx * nav.right.x + target.dy * nav.right.y
          const keys: string[] = []
          if (Math.abs(forward) > Math.abs(right) * 0.4) keys.push(forward > 0 ? 'KeyW' : 'KeyS')
          if (Math.abs(right) > Math.abs(forward) * 0.4) keys.push(right > 0 ? 'KeyD' : 'KeyA')
          if (keys.length) add('approach', 'Hold observed WASD direction toward nearest visible enemy marker. Best when far or during active Frenzy.', keys, target.distance < 12 ? 550 : 1700)
          if (nav.blocked >= 2) {
            const escape = [['KeyA'], ['KeyD'], ['KeyS']][Math.floor(nav.blocked / 2) % 3]!
            add('unstick', 'Movement made no visible progress; sidestep obstacle using ' + escape[0]!.slice(3), escape, 1700)
          }
        }
      }
    }
  }
  return stage.allowed ? all.filter(action => stage.allowed!.includes(action.id)) : all
}
export function decisionState(o: Observation, nav: Navigation) {
  const target = nearest(o)
  return {
    screen: o.mode, health: o.hpRatio === null ? 'unknown' : o.hpRatio < 0.25 ? 'low' : 'healthy',
    enemies: o.remaining === 0 ? 'none' : 'remaining',
    nearestMarker: target ? (target.distance <= 9 ? 'close' : 'far') : 'not visible',
    musouReady: o.musouReady,
    combatGuide: /蒼龍破陣|Azure Dragon Assault/.test(o.moveHint) ? 'frenzy active' : 'normal',
    movementCalibration: !nav.forward ? 'need W probe' : !nav.right ? 'need D probe' : 'complete',
    movementBlocked: nav.blocked >= 2,
  }
}
export function requestDecision(goal: string, stage: Stage, o: Observation, nav: Navigation, actions: Action[]) {
  const criteria = Object.fromEntries(actions.map(a => [a.id, a.description]))
  criteria.no_action = 'No offered current action advances the goal; stop and report missing evidence'
  return {
    model: 'jev-1.13.0',
    state: { goal, stageGoal: stage.goal, observed: decisionState(o, nav) },
    questions: { next_action: {
      type: 'choice',
      instructions: 'Choose the next legal player action toward the current stage goal. Options are real buttons, bounded physical keyboard gestures, or waiting for an observed transition. For winning: wait for results when enemies are gone; otherwise complete movement calibration first; unstick if blocked; approach far markers or sweep toward markers during active Frenzy; attack close markers; prefer ready musou near markers. Pause or guard only when requested by the current stage. You do not decide whether the test passed.',
      criteria,
    } },
  }
}
export function acceptedChoice(raw: unknown, request: ReturnType<typeof requestDecision>, threshold: number): string | null {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1 || !raw || typeof raw !== 'object') return null
  const r = raw as { model?: string; answers?: { next_action?: { type?: string; choice?: string; confidence?: number; probabilities?: Record<string, number> } } }
  const a = r.answers?.next_action
  const choices = Object.keys(request.questions.next_action.criteria)
  if (r.model !== request.model || a?.type !== 'choice' || !a.choice || !choices.includes(a.choice)
      || a.choice === 'no_action' || typeof a.confidence !== 'number' || !Number.isFinite(a.confidence)
      || a.confidence < threshold || a.confidence > 1 || !a.probabilities
      || Object.keys(a.probabilities).length !== choices.length) return null
  const values = choices.map(key => a.probabilities![key]!)
  if (values.some(p => !Number.isFinite(p) || p < 0 || p > 1)) return null
  const rounded = values.every(p => Math.abs(p * 100 - Math.round(p * 100)) < 1e-8)
  const tolerance = rounded ? values.length * 0.005 + 1e-8 : 0.001
  if (Math.abs(values.reduce((s, p) => s + p, 0) - 1) > tolerance || a.probabilities[a.choice] !== Math.max(...values)) return null
  return a.choice
}
/** Cache only exactly matching compact decision inputs; gestures are rebuilt from fresh pixels. */
export function cacheKey(request: ReturnType<typeof requestDecision>): string { return JSON.stringify(request) }
export function updateNavigation(nav: Navigation, action: Action, before: Observation, after: Observation): Navigation {
  const a = before.map.player, b = after.map.player
  if (!a || !b || after.mode !== 'playing') return nav
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy)
  const next = { ...nav }
  if (distance > 1) {
    const basis = { x: dx / distance, y: dy / distance }
    if (action.id === 'calibrate_forward') next.forward = basis
    if (action.id === 'calibrate_right') next.right = basis
  }
  if (['approach', 'unstick'].includes(action.id)) next.blocked = distance < 1.2 ? next.blocked + 1 : 0
  return next
}
