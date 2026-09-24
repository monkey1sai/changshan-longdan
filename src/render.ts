import type { GameState } from './game.ts'

const BACKGROUND_COLOR = '#0f172a'
const PLAYER_COLOR = '#38bdf8'

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = BACKGROUND_COLOR
  ctx.fillRect(0, 0, state.width, state.height)

  const { position, size } = state.player
  ctx.fillStyle = PLAYER_COLOR
  ctx.fillRect(position.x, position.y, size, size)
}
