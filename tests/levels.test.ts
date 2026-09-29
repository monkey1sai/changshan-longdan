import { describe, expect, it } from 'vitest'
import { createRng } from '../src/core/math.ts'
import { BODY_RADIUS, squadSpawns } from '../src/entities/enemies.ts'
import { LEVEL_IDS, levelObstacles, levelSpawns, MANOR_HALL, MANOR_HOUSES, PLAY_LIMIT, PLAYER_START } from '../src/world/levels.ts'

describe('可選關卡配置', () => {
  for (const level of LEVEL_IDS) {
    it(`${level}：300 名敵人的出生點與牆屋不重疊`, () => {
      const enemies = squadSpawns(levelSpawns(level), createRng(7))
      expect(enemies).toHaveLength(300)
      for (const enemy of enemies) {
        expect(Math.abs(enemy.x)).toBeLessThan(PLAY_LIMIT - BODY_RADIUS)
        expect(Math.abs(enemy.z)).toBeLessThan(PLAY_LIMIT - BODY_RADIUS)
        expect(Math.hypot(enemy.x - PLAYER_START.x, enemy.z - PLAYER_START.z)).toBeGreaterThan(10)
        for (const wall of levelObstacles(level)) {
          const inside = enemy.x > wall.minX - BODY_RADIUS && enemy.x < wall.maxX + BODY_RADIUS && enemy.z > wall.minZ - BODY_RADIUS && enemy.z < wall.maxZ + BODY_RADIUS
          expect(inside, `${level}: (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)}) 進入建築`).toBe(false)
        }
      }
    })
  }

  it('宅邸主樓、村屋與庭園都有碰撞資料', () => {
    expect(levelObstacles('moonlit-manor')).toEqual(expect.arrayContaining([MANOR_HALL, ...MANOR_HOUSES]))
    expect(levelObstacles('moonlit-manor').length).toBeGreaterThan(MANOR_HOUSES.length + 1)
  })
})
