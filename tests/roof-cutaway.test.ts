import { describe, expect, it } from 'vitest'
import { Texture } from 'three'
import { updateRoofCutaway } from '../src/view/roof-cutaway.ts'
import { buildCastle } from '../src/world/castle.ts'
import { BARRACKS, BARRACKS_ROOF_OVERHANG } from '../src/world/layout.ts'

describe('營房屋簷剖視', () => {
  const makeRoofs = () => BARRACKS.map(() => ({ visible: true }))

  it.each(BARRACKS.map((r, i) => [i, (r.minX + r.maxX) / 2, r.minZ - 0.45]))('貼近第%s座屋簷只剖開該屋頂，離開後恢復', (index, x, z) => {
    const roofs = makeRoofs()
    updateRoofCutaway(roofs, x, z, false)
    expect(roofs.map(r => r.visible)).toEqual(BARRACKS.map((_, i) => i !== index))
    updateRoofCutaway(roofs, 0, 42, false)
    expect(roofs.every(r => r.visible)).toBe(true)
  })

  it('外框邊緣保留退出緩衝，標題畫面恢復所有屋頂', () => {
    const roofs = makeRoofs()
    const edge = BARRACKS[1].minX - BARRACKS_ROOF_OVERHANG
    updateRoofCutaway(roofs, edge - 0.61, 0, false)
    expect(roofs[1].visible).toBe(true)
    updateRoofCutaway(roofs, edge - 0.8, 0, false)
    expect(roofs[1].visible).toBe(true)
    updateRoofCutaway(roofs, edge - 0.59, 0, false)
    expect(roofs[1].visible).toBe(false)
    updateRoofCutaway(roofs, edge - 0.8, 0, false)
    expect(roofs[1].visible).toBe(false)
    updateRoofCutaway(roofs, edge - 1.01, 0, false)
    expect(roofs[1].visible).toBe(true)
    updateRoofCutaway(roofs, 39.55, 0, false)
    expect(roofs[1].visible).toBe(false)
    updateRoofCutaway(roofs, 39.55, 0, true)
    expect(roofs.every(r => r.visible)).toBe(true)
    updateRoofCutaway(roofs, 39.55, 0, false)
    expect(roofs[1].visible).toBe(false)
  })

  it('城池提供六個獨立且依共享配置排列的屋頂，不隱藏牆身', () => {
    const castle = buildCastle(new Texture())
    expect(castle.barracksRoofs).toHaveLength(BARRACKS.length)
    castle.barracksRoofs.forEach((mesh, i) => {
      mesh.geometry.computeBoundingBox()
      const bounds = mesh.geometry.boundingBox!
      expect(bounds.min.x).toBeCloseTo(BARRACKS[i].minX - BARRACKS_ROOF_OVERHANG)
      expect(bounds.max.z).toBeCloseTo(BARRACKS[i].maxZ + BARRACKS_ROOF_OVERHANG)
      expect(bounds.min.y).toBeGreaterThan(4)
      expect(mesh.parent).toBe(castle.group)
    })
    updateRoofCutaway(castle.barracksRoofs, 39.55, 0, false)
    expect(castle.group.children[0].visible).toBe(true)
  })
})
