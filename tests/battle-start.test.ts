import { describe, expect, it, vi } from 'vitest'
import { Game } from '../src/game.ts'
import type { DifficultyId } from '../src/core/difficulty.ts'

type BattleHarness = {
  mode: string
  difficulty: DifficultyId
  screens: { selectedDifficulty: () => DifficultyId }
  startBattle: () => void
  handleModeInput: (input: Record<string, boolean>) => void
}

// Exercise the production start/input methods without constructing the WebGL renderer.
function battle(mode = 'title', difficulty: DifficultyId = 'chaos') {
  const reset = vi.fn()
  const selectedDifficulty = vi.fn((): DifficultyId => difficulty)
  const game = Object.assign(Object.create(Game.prototype), {
    mode, difficulty: 'normal',
    screens: { selectedDifficulty, showTitle: vi.fn(), showPause: vi.fn(), hideResult: vi.fn() },
    ensureAudio: vi.fn(), resetBattle: reset,
    hud: { setVisible: vi.fn(), showBanner: vi.fn() },
    rig: { snap: vi.fn() }, player: { pos: {} }, music: null, audio: null,
  }) as BattleHarness
  return { game, reset, selectedDifficulty }
}

describe('battle entry difficulty', () => {
  for (const difficulty of ['beginner', 'normal', 'hard', 'chaos'] as const) {
    for (const entry of ['button', 'confirm', 'attack']) {
      it(`${difficulty} / ${entry} applies the title selection before resetting enemies`, () => {
        const { game, reset, selectedDifficulty } = battle('title', difficulty)
        reset.mockImplementation(() => expect(game.difficulty).toBe(difficulty))
        if (entry === 'button') game.startBattle()
        else game.handleModeInput({ [entry]: true })
        expect(selectedDifficulty).toHaveBeenCalledOnce()
        expect(reset).toHaveBeenCalledOnce()
        expect(game.mode).toBe('playing')
      })
    }
  }
  it('retry retains the battle difficulty instead of rereading the hidden selector', () => {
    const { game, selectedDifficulty } = battle('defeat')
    game.difficulty = 'hard'
    game.startBattle()
    expect(game.difficulty).toBe('hard')
    expect(selectedDifficulty).not.toHaveBeenCalled()
  })
})
