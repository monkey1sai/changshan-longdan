import { createGame, update } from './game.ts'
import { createKeyboardInput } from './input.ts'
import { render } from './render.ts'

// 切換分頁回來時 dt 可能很大，單格最多推進 0.1 秒，避免角色瞬移
const MAX_DT = 0.1

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const ctx = canvas?.getContext('2d')
if (!canvas || !ctx) {
  throw new Error('找不到 #game canvas，或瀏覽器不支援 Canvas 2D')
}

const input = createKeyboardInput(window)
let state = createGame(canvas.width, canvas.height)
let last = performance.now()

const frame = (now: number): void => {
  const dt = Math.min((now - last) / 1000, MAX_DT)
  last = now
  state = update(state, input, dt)
  render(ctx, state)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
