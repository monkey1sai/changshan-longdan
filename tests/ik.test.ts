import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { solveTwoBone } from '../src/core/ik.ts'

describe('solveTwoBone', () => {
  it('目標在臂長內時兩節骨長不變且手到達目標', () => {
    const root = new Vector3(0, 1.5, 0)
    const target = new Vector3(0.2, 1.1, 0.4)
    const elbow = new Vector3()
    const hand = new Vector3()
    solveTwoBone(root, target, new Vector3(0, 0, -1), 0.32, 0.3, elbow, hand)
    expect(elbow.distanceTo(root)).toBeCloseTo(0.32, 5)
    expect(hand.distanceTo(elbow)).toBeCloseTo(0.3, 5)
    expect(hand.distanceTo(target)).toBeCloseTo(0, 5)
  })

  it('手肘彎向極點那一側', () => {
    const root = new Vector3(0, 0, 0)
    const elbow = new Vector3()
    const hand = new Vector3()
    solveTwoBone(root, new Vector3(0, 0, 0.4), new Vector3(0, -1, 0.2), 0.3, 0.3, elbow, hand)
    expect(elbow.y).toBeLessThan(0)
  })

  it('目標太遠時手臂伸直指向目標', () => {
    const root = new Vector3(0, 0, 0)
    const elbow = new Vector3()
    const hand = new Vector3()
    solveTwoBone(root, new Vector3(0, 0, 5), new Vector3(0, -1, 0), 0.3, 0.3, elbow, hand)
    expect(hand.z).toBeCloseTo(0.6, 3)
    expect(Math.abs(hand.x) + Math.abs(hand.y)).toBeLessThan(1e-3)
  })
})
