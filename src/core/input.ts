export interface InputFrame {
  moveX: number // 右為正
  moveY: number // 前為正
  camTurn: number // 右轉為正
  zoom: number // 滾輪
  attack: boolean // 以下為本幀按下
  charge: boolean
  jump: boolean
  dodge: boolean
  musou: boolean
  pause: boolean
  confirm: boolean
  debug: boolean
}

type Action = 'attack' | 'charge' | 'jump' | 'dodge' | 'musou' | 'pause' | 'confirm' | 'debug'

const KEY_ACTIONS = new Map<string, Action>([
  ['KeyJ', 'attack'],
  ['KeyK', 'charge'],
  ['KeyL', 'musou'],
  ['Space', 'jump'],
  ['ShiftLeft', 'dodge'],
  ['ShiftRight', 'dodge'],
  ['Escape', 'pause'],
  ['KeyP', 'pause'],
  ['Enter', 'confirm'],
  ['F3', 'debug'],
])

const GAME_KEYS = new Set([...KEY_ACTIONS.keys(), 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

// 標準手把配置：0 ×、1 ○、2 □、3 △、5 R1、7 R2、9 Start
const PAD_ACTIONS: [number, Action][] = [
  [2, 'attack'],
  [3, 'charge'],
  [1, 'musou'],
  [0, 'jump'],
  [5, 'dodge'],
  [7, 'dodge'],
  [9, 'pause'],
  [0, 'confirm'],
]

function deadzone(v: number): number {
  return Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8
}

/** 鍵盤、滑鼠與手把輸入，每幀 poll 一次取得移動量與「本幀按下」的動作。 */
export class Input {
  private readonly held = new Set<string>()
  private readonly pressed = new Set<Action>()
  private readonly padPrev: boolean[] = []
  private wheel = 0

  constructor(target: Window, surface: HTMLElement) {
    target.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault()
      this.held.add(e.code)
      if (e.repeat) return
      const action = KEY_ACTIONS.get(e.code)
      if (action !== undefined) this.pressed.add(action)
    })
    target.addEventListener('keyup', (e) => this.held.delete(e.code))
    target.addEventListener('blur', () => this.held.clear())
    surface.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.pressed.add('attack')
      else if (e.button === 2) this.pressed.add('charge')
    })
    surface.addEventListener('contextmenu', (e) => e.preventDefault())
    surface.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY)
        e.preventDefault()
      },
      { passive: false },
    )
  }

  poll(): InputFrame {
    const k = (code: string) => (this.held.has(code) ? 1 : 0)
    let moveX = Math.max(k('KeyD'), k('ArrowRight')) - Math.max(k('KeyA'), k('ArrowLeft'))
    let moveY = Math.max(k('KeyW'), k('ArrowUp')) - Math.max(k('KeyS'), k('ArrowDown'))
    let camTurn = k('KeyE') - k('KeyQ')

    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
    const pad = pads.find((p) => p !== null && p.connected) ?? null
    if (pad !== null) {
      moveX += deadzone(pad.axes[0] ?? 0)
      moveY -= deadzone(pad.axes[1] ?? 0)
      camTurn += deadzone(pad.axes[2] ?? 0)
      for (const [index, action] of PAD_ACTIONS) {
        const down = pad.buttons[index]?.pressed === true
        if (down && this.padPrev[index] !== true) this.pressed.add(action)
      }
      pad.buttons.forEach((b, i) => {
        this.padPrev[i] = b.pressed
      })
    }

    const len = Math.hypot(moveX, moveY)
    if (len > 1) {
      moveX /= len
      moveY /= len
    }
    const frame: InputFrame = {
      moveX,
      moveY,
      camTurn: Math.max(-1, Math.min(1, camTurn)),
      zoom: this.wheel,
      attack: this.pressed.has('attack'),
      charge: this.pressed.has('charge'),
      jump: this.pressed.has('jump'),
      dodge: this.pressed.has('dodge'),
      musou: this.pressed.has('musou'),
      pause: this.pressed.has('pause'),
      confirm: this.pressed.has('confirm'),
      debug: this.pressed.has('debug'),
    }
    this.pressed.clear()
    this.wheel = 0
    return frame
  }
}
