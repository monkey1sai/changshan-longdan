import { describe, expect, it } from 'vitest'
import { decodeEnemyPixels } from '../scripts/lib/baseline-visibility.ts'

describe('enemy ID readback must not invent visible population', () => {
  it('counts unique alive IDs while retaining every pixel count', () => {
    expect(decodeEnemyPixels(new Uint8Array([0, 0, 0, 0, 1, 0, 0, 255, 1, 0, 0, 255, 2, 0, 0, 255]), [true, true]))
      .toEqual({ visible: 2, pixelCounts: [2, 1], visibleIds: [0, 1] })
  })
  it('uses all RGB bytes so instance IDs above 255 remain distinct', () => {
    const alive = Array<boolean>(300).fill(true)
    const result = decodeEnemyPixels(new Uint8Array([1, 1, 0, 255]), alive)
    expect(result.visibleIds).toEqual([256])
    expect(result.pixelCounts[256]).toBe(1)
  })
  it('preserves a zero count when all enemy geometry is occluded', () => {
    expect(decodeEnemyPixels(new Uint8Array(16), [true])).toEqual({ visible: 0, pixelCounts: [0], visibleIds: [] })
  })
  it.each([[1, 0, 0, 255], [2, 0, 0, 255]])('rejects dead or unknown ID pixels', (...bytes) => {
    expect(() => decodeEnemyPixels(new Uint8Array(bytes), [false])).toThrow(/unknown\/dead/)
  })
  it('rejects malformed RGBA instead of treating incomplete data as zero', () => {
    expect(() => decodeEnemyPixels(new Uint8Array(3), [true])).toThrow(/RGBA/)
  })
})
