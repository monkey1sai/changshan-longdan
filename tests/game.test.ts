import { describe, expect, it } from 'vitest'
import { createGame, direction, update, type InputState } from '../src/game.ts'

const idle: InputState = { left: false, right: false, up: false, down: false }

describe('direction', () => {
  it('沒有按鍵時不移動', () => {
    expect(direction(idle)).toEqual({ x: 0, y: 0 })
  })

  it('同時按下相反方向會互相抵銷', () => {
    expect(direction({ ...idle, left: true, right: true })).toEqual({ x: 0, y: 0 })
  })

  it('斜向移動正規化為單位向量', () => {
    const { x, y } = direction({ ...idle, right: true, down: true })
    expect(x).toBeCloseTo(Math.SQRT1_2)
    expect(y).toBeCloseTo(Math.SQRT1_2)
  })
})

describe('update', () => {
  it('依速度與 dt 移動玩家', () => {
    const game = createGame(800, 450)
    const next = update(game, { ...idle, right: true }, 0.5)
    expect(next.player.position).toEqual({
      x: game.player.position.x + game.player.speed * 0.5,
      y: game.player.position.y,
    })
  })

  it('玩家停在畫面邊界內', () => {
    const game = createGame(800, 450)
    const { size } = game.player
    expect(update(game, { ...idle, left: true, up: true }, 60).player.position).toEqual({ x: 0, y: 0 })
    expect(update(game, { ...idle, right: true, down: true }, 60).player.position).toEqual({
      x: 800 - size,
      y: 450 - size,
    })
  })

  it('不修改傳入的狀態', () => {
    const game = createGame(800, 450)
    const before = structuredClone(game)
    update(game, { ...idle, down: true }, 1)
    expect(game).toEqual(before)
  })
})
