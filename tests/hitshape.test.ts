import { describe, expect, it } from 'vitest'
import { inHitShape, shapeReach, type HitShape } from '../src/combat/hitshape.ts'

const NORTH = Math.PI // 面向 -z

describe('inHitShape', () => {
  it('圓形判定包含目標半徑', () => {
    const shape: HitShape = { kind: 'circle', range: 3 }
    expect(inHitShape(shape, 0, 0, 0, 3.3, 0, 0.4)).toBe(true)
    expect(inHitShape(shape, 0, 0, 0, 3.5, 0, 0.4)).toBe(false)
  })

  it('扇形只打前方角度內的目標', () => {
    const shape: HitShape = { kind: 'arc', range: 3, halfAngle: Math.PI / 4 }
    expect(inHitShape(shape, 0, 0, NORTH, 0, -2, 0.3)).toBe(true)
    expect(inHitShape(shape, 0, 0, NORTH, 0, 2, 0.3)).toBe(false) // 背後
    expect(inHitShape(shape, 0, 0, NORTH, 2, -0.3, 0.3)).toBe(false) // 側邊超出角度
  })

  it('貼身的目標一律命中扇形', () => {
    const shape: HitShape = { kind: 'arc', range: 3, halfAngle: 0.2 }
    expect(inHitShape(shape, 0, 0, NORTH, 0.1, 0.1, 0.4)).toBe(true)
  })

  it('直線判定依長度與寬度篩選', () => {
    const shape: HitShape = { kind: 'line', range: 4, width: 1 }
    expect(inHitShape(shape, 0, 0, NORTH, 0.6, -3.5, 0.3)).toBe(true)
    expect(inHitShape(shape, 0, 0, NORTH, 1.2, -3.5, 0.3)).toBe(false)
    expect(inHitShape(shape, 0, 0, NORTH, 0, -4.5, 0.3)).toBe(false)
  })

  it('offset 會把判定中心沿面向平移', () => {
    const shape: HitShape = { kind: 'circle', range: 1, offset: 3 }
    expect(inHitShape(shape, 0, 0, NORTH, 0, -3, 0.2)).toBe(true)
    expect(inHitShape(shape, 0, 0, NORTH, 0, 0, 0.2)).toBe(false)
  })

  it('shapeReach 涵蓋形狀的最遠點', () => {
    expect(shapeReach({ kind: 'circle', range: 2, offset: 1 })).toBe(3)
    expect(shapeReach({ kind: 'line', range: 3, width: 8 })).toBe(5)
  })
})
