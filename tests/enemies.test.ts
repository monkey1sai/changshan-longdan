import { describe, expect, it } from 'vitest'
import type { HitWindow } from '../src/combat/moves.ts'
import { createRng } from '../src/core/math.ts'
import { Arena } from '../src/entities/arena.ts'
import { EnemyStore, Kind, State, type HitInfo, type Spawn } from '../src/entities/enemies.ts'

const arena = new Arena(100, [])

function makeStore(spawns: Spawn[]): EnemyStore {
  const store = new EnemyStore(spawns.length)
  store.reset(spawns)
  return store
}

function window(extra: Partial<HitWindow> = {}): HitWindow {
  return {
    t0: 0, t1: 0.1, shape: { kind: 'circle', range: 3 }, damage: 10, reaction: 'flinch',
    push: 3, lift: 0, hitstop: 0.05, shake: 0.1, sfx: 'light', ...extra,
  }
}

const soldier = (x: number, z: number, kind: Kind = Kind.Spear): Spawn => ({ x, z, yaw: 0, kind })

describe('EnemyStore.applyHit', () => {
  it('打到範圍內的士兵，同一 stamp 不重複命中', () => {
    const store = makeStore([soldier(1, 0), soldier(0, 2), soldier(10, 0)])
    const out: HitInfo[] = []
    store.applyHit(1, window(), 0, 0, 0, 0, out)
    expect(out.map((h) => h.id).sort()).toEqual([0, 1])
    out.length = 0
    store.applyHit(1, window(), 0, 0, 0, 0, out)
    expect(out).toHaveLength(0)
    expect(store.state[0]).toBe(State.Flinch)
  })

  it('血量歸零時擊破並留下擊破資訊', () => {
    const store = makeStore([soldier(1, 0)])
    const out: HitInfo[] = []
    store.applyHit(2, window({ damage: 999, push: 10, radial: true }), 0, 0, 0, 0, out)
    expect(out[0].killed).toBe(true)
    expect(store.aliveCount).toBe(0)
    expect(store.kills).toHaveLength(1)
    expect(store.kills[0].vx).toBeGreaterThan(0) // 往遠離攻擊者的方向飛散
  })

  it('挑空攻擊讓士兵飛起，落地後倒地', () => {
    const store = makeStore([soldier(1, 0)])
    store.applyHit(3, window({ reaction: 'launch', lift: 9 }), 0, 0, 0, 0, [])
    expect(store.state[0]).toBe(State.Air)
    for (let i = 0; i < 120 && store.state[0] === State.Air; i++) store.update(1 / 60, 20, 0, 20, arena)
    expect(store.state[0]).toBe(State.Down)
    expect(store.y[0]).toBe(0)
  })

  it('判定高度以外的士兵不會被打到', () => {
    const store = makeStore([soldier(1, 0)])
    store.y[0] = 6
    const out: HitInfo[] = []
    store.applyHit(4, window(), 0, 0, 0, 0, out)
    expect(out).toHaveLength(0)
  })
})

describe('EnemyStore.update', () => {
  it('玩家靠近時士兵包圍上來，同時出手人數有上限且會實際出手', () => {
    const rng = createRng(3)
    const spawns: Spawn[] = Array.from({ length: 40 }, () => soldier((rng() - 0.5) * 30, (rng() - 0.5) * 30))
    const store = makeStore(spawns)
    let strikes = 0
    let maxAttackers = 0
    for (let i = 0; i < 60 * 12; i++) {
      store.update(1 / 60, 0, 0, 0, arena)
      strikes += store.strikes.length
      maxAttackers = Math.max(maxAttackers, store.attackerCount)
    }
    expect(strikes).toBeGreaterThan(0)
    expect(maxAttackers).toBeLessThanOrEqual(4)
    const near = Array.from({ length: 40 }, (_, i) => Math.hypot(store.x[i], store.z[i])).filter((d) => d < 8)
    expect(near.length).toBeGreaterThan(10)
  })

  it('士兵之間互相推開、不會重疊，也不會站進玩家身上', () => {
    const store = makeStore(Array.from({ length: 12 }, () => soldier(0.5, 0.5)))
    for (let i = 0; i < 120; i++) store.update(1 / 60, 0, 0, 0, arena)
    for (let a = 0; a < 12; a++) {
      expect(Math.hypot(store.x[a], store.z[a])).toBeGreaterThan(0.9)
      for (let b = a + 1; b < 12; b++) {
        expect(Math.hypot(store.x[a] - store.x[b], store.z[a] - store.z[b])).toBeGreaterThan(0.5)
      }
    }
  })

  it('隊長比一般士兵耐打', () => {
    const store = makeStore([soldier(1, 0, Kind.Captain), soldier(-1, 0)])
    expect(store.maxHp[0]).toBeGreaterThan(store.maxHp[1] * 3)
  })
})
