import { describe, expect, it } from 'vitest'
import { DIFFICULTIES } from '../src/core/difficulty.ts'
import { Arena } from '../src/entities/arena.ts'
import { EnemyStore, Kind, type Spawn } from '../src/entities/enemies.ts'

const arena = new Arena(100, [])
const soldiers: Spawn[] = Array.from({ length: 24 }, (_, i) => ({
  x: (i % 6) * 1.5 - 4,
  z: Math.floor(i / 6) * 1.5 - 3,
  yaw: 0,
  kind: i === 0 ? Kind.Captain : Kind.Spear,
}))

describe('EnemyStore difficulty pressure', () => {
  it('難度會改變隊長耐久', () => {
    const easy = new EnemyStore(24, 3)
    easy.setPressure(DIFFICULTIES.beginner)
    easy.reset(soldiers)
    const chaos = new EnemyStore(24, 3)
    chaos.setPressure(DIFFICULTIES.chaos)
    chaos.reset(soldiers)
    expect(chaos.maxHp[0]).toBeGreaterThan(easy.maxHp[0] * 2)
  })

  it('初級限制同時攻擊者，修羅允許更高壓力', () => {
    const easy = new EnemyStore(24, 3)
    easy.setPressure(DIFFICULTIES.beginner)
    easy.reset(soldiers)
    const chaos = new EnemyStore(24, 3)
    chaos.setPressure(DIFFICULTIES.chaos)
    chaos.reset(soldiers)
    let easyMax = 0
    let chaosMax = 0
    for (let i = 0; i < 60 * 8; i++) {
      easy.update(1 / 60, 0, 0, 0, arena)
      chaos.update(1 / 60, 0, 0, 0, arena)
      easyMax = Math.max(easyMax, easy.attackerCount)
      chaosMax = Math.max(chaosMax, chaos.attackerCount)
    }
    expect(easyMax).toBeLessThanOrEqual(DIFFICULTIES.beginner.maxAttackers)
    expect(chaosMax).toBeLessThanOrEqual(DIFFICULTIES.chaos.maxAttackers)
    expect(chaosMax).toBeGreaterThan(easyMax)
  })
})
