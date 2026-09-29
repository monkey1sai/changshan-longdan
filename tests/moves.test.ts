import { describe, expect, it } from 'vitest'
import { MOVES, type MoveId } from '../src/combat/moves.ts'

const ALL = Object.keys(MOVES) as MoveId[]

describe('MOVES', () => {
  it('一般連擊 N1–N6 與蓄力 C1–C6 都有定義', () => {
    for (let n = 1; n <= 6; n++) {
      expect(MOVES[`N${n}` as MoveId].id).toBe(`N${n}`)
      expect(MOVES[`C${n}` as MoveId].id).toBe(`C${n}`)
    }
  })

  it('機動突刺與完美格擋反擊都有獨立判定', () => {
    expect(MOVES.DASH.id).toBe('DASH')
    expect(MOVES.COUNTER.id).toBe('COUNTER')
    expect(MOVES.DASH.hits[0].damage).toBeGreaterThan(MOVES.N1.hits[0].damage)
    expect(MOVES.COUNTER.hits[0].damage).toBeGreaterThan(MOVES.DASH.hits[0].damage)
  })

  it.each(ALL)('%s 的時間軸合理', (id) => {
    const m = MOVES[id]
    expect(m.cancel).toBeLessThanOrEqual(m.duration)
    expect(m.hits.length).toBeGreaterThan(0)
    for (const w of m.hits) {
      expect(w.t0).toBeLessThan(w.t1)
      expect(w.t1).toBeLessThanOrEqual(m.duration)
      expect(w.damage).toBeGreaterThan(0)
    }
    for (const [a, b] of m.trail) expect(a).toBeLessThan(b)
  })

  it('有高度曲線的招式最後都會回到地面', () => {
    for (const id of ALL) {
      const h = MOVES[id].height
      if (h === undefined) continue
      expect(h.keys[h.keys.length - 1][1]).toBe(0)
      expect(h.keys[h.keys.length - 1][0]).toBeLessThanOrEqual(MOVES[id].duration)
    }
  })

  it('越後段的蓄力攻擊總傷害越高', () => {
    const total = (id: MoveId) => MOVES[id].hits.reduce((sum, w) => sum + w.damage, 0)
    expect(total('C6')).toBeGreaterThan(total('C1'))
    expect(total('MUSOU')).toBeGreaterThan(total('C6'))
  })
})
