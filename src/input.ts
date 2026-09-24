import type { InputState } from './game.ts'

const KEY_BINDINGS = new Map<string, keyof InputState>([
  ['ArrowLeft', 'left'],
  ['KeyA', 'left'],
  ['ArrowRight', 'right'],
  ['KeyD', 'right'],
  ['ArrowUp', 'up'],
  ['KeyW', 'up'],
  ['ArrowDown', 'down'],
  ['KeyS', 'down'],
])

const released = (): InputState => ({ left: false, right: false, up: false, down: false })

/**
 * 監聽鍵盤並回傳輸入狀態；回傳的物件會隨按鍵即時更新，遊戲迴圈每格讀取即可。
 * 以 KeyboardEvent.code 判斷實體按鍵位置，WASD 不受鍵盤配置影響。
 */
export function createKeyboardInput(target: Window): InputState {
  const input = released()

  const onKey = (pressed: boolean) => (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS.get(event.code)
    if (action === undefined) return
    event.preventDefault() // 避免方向鍵捲動頁面
    input[action] = pressed
  }

  target.addEventListener('keydown', onKey(true))
  target.addEventListener('keyup', onKey(false))
  // 視窗失焦時收不到 keyup，全部放開以免角色持續移動
  target.addEventListener('blur', () => Object.assign(input, released()))

  return input
}
