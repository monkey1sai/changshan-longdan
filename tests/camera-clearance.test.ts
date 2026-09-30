import { describe, expect, it } from 'vitest'
import { cameraClearance } from '../src/view/camera-clearance.ts'

describe('cameraClearance', () => {
  it('開闊區域保留完整鏡頭距離', () => {
    expect(cameraClearance(0, 0, 0, 20)).toBe(1)
  })

  it('boom 穿過營房時會在障礙前收近', () => {
    const clear = cameraClearance(0, 0, 50, 0)
    expect(clear).toBeGreaterThan(0.18)
    expect(clear).toBeLessThan(1)
  })

  it('boom 超出可玩邊界時會收近', () => {
    expect(cameraClearance(0, 0, 80, 40)).toBeLessThan(1)
  })
})
