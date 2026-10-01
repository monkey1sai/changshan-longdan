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

  it('緊靠營房時不強行保留會穿入建物的最短距離', () => {
    const clear = cameraClearance(48.5, 13.1, 48.5, 22.3)
    expect(13.1 + (22.3 - 13.1) * clear).toBeLessThan(14 - 0.35)
  })

  it('緊靠南牆時不強行越過安全邊界', () => {
    const clear = cameraClearance(0, 54.55, 0, 55.5)
    expect(54.55 + (55.5 - 54.55) * clear).toBeLessThanOrEqual(55 - 0.35)
  })
})
