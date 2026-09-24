import { describe, expect, it } from 'vitest'
import { createRng } from '../src/core/math.ts'
import { BODY_RADIUS, squadSpawns } from '../src/entities/enemies.ts'
import { BRAZIERS, obstacles, PLAY_LIMIT, PLAYER_START, SQUADS } from '../src/world/layout.ts'

describe('城池配置', () => {
  const spawns = squadSpawns(SQUADS, createRng(1))

  it('魏軍總數是 300', () => {
    expect(spawns).toHaveLength(300)
  })

  it('出生點不在障礙物內，也不在城牆外', () => {
    const rects = obstacles()
    for (const s of spawns) {
      expect(Math.abs(s.x)).toBeLessThan(PLAY_LIMIT - BODY_RADIUS)
      expect(Math.abs(s.z)).toBeLessThan(PLAY_LIMIT - BODY_RADIUS)
      for (const r of rects) {
        const inside =
          s.x > r.minX - BODY_RADIUS && s.x < r.maxX + BODY_RADIUS && s.z > r.minZ - BODY_RADIUS && s.z < r.maxZ + BODY_RADIUS
        expect(inside, `(${s.x.toFixed(1)}, ${s.z.toFixed(1)}) 落在障礙物內`).toBe(false)
      }
    }
  })

  it('趙雲出生點 15 公尺內沒有魏兵', () => {
    for (const s of spawns) expect(Math.hypot(s.x - PLAYER_START.x, s.z - PLAYER_START.z)).toBeGreaterThan(15)
  })

  it('火盆都在城內', () => {
    for (const b of BRAZIERS) {
      expect(Math.abs(b.x)).toBeLessThan(PLAY_LIMIT)
      expect(Math.abs(b.z)).toBeLessThan(PLAY_LIMIT)
    }
  })
})
