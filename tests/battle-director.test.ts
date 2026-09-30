import { describe, expect, it } from 'vitest'
import { DIFFICULTIES } from '../src/core/difficulty.ts'
import { BattleDirector } from '../src/entities/battle-director.ts'

describe('BattleDirector', () => {
  it('隨擊破數提高戰場壓力', () => {
    const d = new BattleDirector()
    expect(d.update(0, DIFFICULTIES.normal).phase.id).toBe('opening')
    expect(d.update(60, DIFFICULTIES.normal).phase.id).toBe('pressure')
    expect(d.update(150, DIFFICULTIES.normal).phase.id).toBe('surge')
    expect(d.update(240, DIFFICULTIES.normal).phase.id).toBe('finale')
  })

  it('難度與戰況疊加攻擊者上限', () => {
    const d = new BattleDirector()
    expect(d.update(0, DIFFICULTIES.beginner).maxAttackers).toBe(2)
    expect(d.update(240, DIFFICULTIES.chaos).maxAttackers).toBe(8)
  })
})
