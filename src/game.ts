export interface Vec2 {
  x: number
  y: number
}

export interface InputState {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

export interface Player {
  position: Vec2 // 左上角座標（像素）
  size: number // 邊長（像素）
  speed: number // 移動速度（像素／秒）
}

export interface GameState {
  width: number
  height: number
  player: Player
}

export function createGame(width: number, height: number): GameState {
  const size = 32
  return {
    width,
    height,
    player: {
      position: { x: (width - size) / 2, y: (height - size) / 2 },
      size,
      speed: 240,
    },
  }
}

/** 把輸入轉成單位方向向量，斜向移動不會比直線快。 */
export function direction(input: InputState): Vec2 {
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const y = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  const length = Math.hypot(x, y)
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length }
}

/** 推進一格遊戲時間（dt 單位為秒）。回傳新狀態，不修改傳入的 state。 */
export function update(state: GameState, input: InputState, dt: number): GameState {
  const { player } = state
  const move = direction(input)
  return {
    ...state,
    player: {
      ...player,
      position: {
        x: clamp(player.position.x + move.x * player.speed * dt, 0, state.width - player.size),
        y: clamp(player.position.y + move.y * player.speed * dt, 0, state.height - player.size),
      },
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
