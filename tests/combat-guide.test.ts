import { describe, expect, it } from 'vitest'
import { type MoveId } from '../src/combat/moves.ts'
import { combatGuide } from '../src/ui/combat-guide.ts'
import { moveName, setLocale } from '../src/ui/i18n.ts'

describe('combatGuide', () => {
  it('每段普攻提示實際可接的蓄力分支', () => {
    for (let n = 1; n <= 6; n++) {
      expect(combatGuide('attack', `N${n}` as MoveId, 0)).toContain(moveName(`C${Math.min(6, n + 1)}` as MoveId))
    }
  })
  it('只在守勢且反擊窗口仍存在時提示精準反擊', () => {
    expect(combatGuide('guard', null, 0.4)).toContain('精準格擋！')
    expect(combatGuide('move', null, 0.4)).toContain('精準格擋！')
    expect(combatGuide('guard', null, 0)).not.toContain('精準格擋！')
    expect(combatGuide('down', null, 0.4)).not.toContain('精準格擋！')
  })
  it('空中與閃避具有不同銜接說明', () => {
    expect(combatGuide('jump', null, 0)).toContain('俯衝')
    expect(combatGuide('dodge', null, 0)).toContain('突進')
  })

  it('英文語系提供相同的連段與狀態提示', () => {
    setLocale('en')
    expect(combatGuide('attack', 'N3', 0)).toContain('Dragon Wheel')
    expect(combatGuide('guard', null, 0.4)).toContain('Perfect guard')
    expect(combatGuide('jump', null, 0)).toContain('dive')
    setLocale('zh-Hant')
  })
})
