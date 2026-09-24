import { describe, expect, it } from 'vitest'
import { SpatialHash } from '../src/core/spatial-hash.ts'

describe('SpatialHash', () => {
  it('查詢會回傳範圍內格子的所有編號，包括負座標', () => {
    const hash = new SpatialHash(2)
    hash.insert(1, 0.5, 0.5)
    hash.insert(2, -0.5, -0.5)
    hash.insert(3, 10, 10)
    const found = hash.query(0, 0, 1, []).sort()
    expect(found).toEqual([1, 2])
  })

  it('clear 後格子會被回收重用且不殘留舊資料', () => {
    const hash = new SpatialHash(2)
    hash.insert(1, 0, 0)
    hash.clear()
    hash.insert(2, 5, 5)
    expect(hash.query(0, 0, 1, [])).toEqual([])
    expect(hash.query(5, 5, 1, [])).toEqual([2])
  })
})
