import { describe, expect, it } from 'vitest'
import { nextMove, type ComboContext } from '../src/combat/combo.ts'
import type { MoveId } from '../src/combat/moves.ts'

const ground = (current: MoveId | null, normalCount = 0, canChain = true): ComboContext => ({
  current,
  normalCount,
  airborne: false,
  canChain,
})

describe('nextMove', () => {
  it('自由狀態下普攻出 N1、蓄力出 C1', () => {
    expect(nextMove(ground(null), 'attack')).toBe('N1')
    expect(nextMove(ground(null), 'charge')).toBe('C1')
  })

  it('普攻依序接 N1→N6，N6 之後不再接', () => {
    for (let n = 1; n < 6; n++) expect(nextMove(ground(`N${n}` as MoveId, n), 'attack')).toBe(`N${n + 1}`)
    expect(nextMove(ground('N6', 6), 'attack')).toBeNull()
  })

  it('Nk 之後按蓄力出 C(k+1)，最多到 C6', () => {
    for (let n = 1; n <= 5; n++) expect(nextMove(ground(`N${n}` as MoveId, n), 'charge')).toBe(`C${n + 1}`)
    expect(nextMove(ground('N6', 6), 'charge')).toBeNull()
  })

  it('還沒到可接招時間不接', () => {
    expect(nextMove(ground('N2', 2, false), 'attack')).toBeNull()
    expect(nextMove(ground('N2', 2, false), 'charge')).toBeNull()
  })

  it('空中只能出一次跳擊或跳躍蓄力', () => {
    const air = { current: null, normalCount: 0, airborne: true, canChain: true }
    expect(nextMove(air, 'attack')).toBe('JA')
    expect(nextMove(air, 'charge')).toBe('JC')
    expect(nextMove({ ...air, current: 'JA' }, 'attack')).toBeNull()
  })

  it('無雙中不接任何招', () => {
    expect(nextMove(ground('MUSOU'), 'attack')).toBeNull()
    expect(nextMove(ground('MUSOU'), 'charge')).toBeNull()
  })

  it('蓄力攻擊收招後可起新的一串', () => {
    expect(nextMove(ground('C4'), 'attack')).toBe('N1')
    expect(nextMove(ground('C4'), 'charge')).toBe('C1')
  })

  it('機動與反擊招式收招後可重新起一般連段', () => {
    expect(nextMove(ground('DASH'), 'attack')).toBe('N1')
    expect(nextMove(ground('COUNTER'), 'charge')).toBe('C1')
  })
})
