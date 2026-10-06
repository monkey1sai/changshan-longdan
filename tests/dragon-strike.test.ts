import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { MOVES } from '../src/combat/moves.ts'
import { DRAGON_DURATION, DRAGON_HIT_INTERVAL, DragonStrike } from '../src/entities/dragon-strike.ts'

const STEP = 1 / 60
const CENTER = new Vector3(3, 0, -2)

/** 從召喚起逐幀推進，對每一幀呼叫 visit。 */
function run(visit: (d: DragonStrike) => void, facing = 0.4): DragonStrike {
  const d = new DragonStrike()
  d.start(CENTER, facing)
  while (d.active) {
    d.update(STEP, CENTER, facing)
    visit(d)
  }
  return d
}

describe('DragonStrike', () => {
  it('只在盤旋區間 0.35–2.55 秒撞擊敵兵', () => {
    const striking: number[] = []
    run((d) => {
      if (d.striking) striking.push(d.elapsed)
    })
    expect(Math.min(...striking)).toBeGreaterThan(0.35)
    expect(Math.min(...striking)).toBeLessThan(0.35 + STEP * 1.5)
    expect(Math.max(...striking)).toBeLessThan(2.55)
    expect(Math.max(...striking)).toBeGreaterThan(2.55 - STEP * 1.5)
  })

  it('龍頭軌跡由起點、朝向與時間決定', () => {
    const a: number[] = []
    const b: number[] = []
    run((d) => a.push(d.headPos.x, d.headPos.y, d.headPos.z))
    run((d) => b.push(d.headPos.x, d.headPos.y, d.headPos.z))
    expect(a.length).toBeGreaterThan(100)
    expect(b).toEqual(a)
    const turned: number[] = []
    run((d) => turned.push(d.headPos.x, d.headPos.y, d.headPos.z), 2)
    expect(turned).not.toEqual(a)
  })

  it('每 0.12 秒才換新的命中編號，同一名敵兵每段最多被撞一次', () => {
    const changes: number[] = []
    let last = -1
    run((d) => {
      if (!d.striking) return
      if (d.stamp !== last) changes.push(d.elapsed)
      last = d.stamp
    })
    expect(changes.length).toBeGreaterThan(15)
    for (let i = 1; i < changes.length; i++) {
      expect(changes[i] - changes[i - 1]).toBeGreaterThanOrEqual(DRAGON_HIT_INTERVAL - 1e-6)
    }
  })

  it('持續時間與無雙招式等長，結束後自動停止', () => {
    expect(DRAGON_DURATION).toBe(MOVES.MUSOU.duration)
    let lastElapsed = 0
    const d = run((s) => {
      if (s.active) lastElapsed = s.elapsed
    })
    expect(d.active).toBe(false)
    expect(lastElapsed).toBeLessThan(DRAGON_DURATION)
    expect(lastElapsed).toBeGreaterThan(DRAGON_DURATION - STEP * 1.5)
  })
})
