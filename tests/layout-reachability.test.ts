import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { clearanceAt, ReachabilityGrid } from '../scripts/lib/layout-reachability.ts'
import { createRng } from '../src/core/math.ts'
import { Kind, squadSpawns } from '../src/entities/enemies.ts'
import { obstacles, PLAY_LIMIT, PLAYER_START, SQUADS, type Rect } from '../src/world/layout.ts'

const playerSource = readFileSync(new URL('../src/entities/player.ts', import.meta.url), 'utf8')
const radiusMatches = [...playerSource.matchAll(/arena\.constrain\(this\.pos, ([0-9.]+)\)/g)]
const radius = Number(radiusMatches[0]?.[1])
const gap = (width: number): Rect[] => [
  { minX: -3, maxX: -width / 2, minZ: -0.25, maxZ: 0.25 },
  { minX: width / 2, maxX: 3, minZ: -0.25, maxZ: 0.25 },
]

describe('E11 castle reachability (collision geometry, without crowd)', () => {
  it('reaches all 25 squad centres and all 9 seed-7 captain positions with a full player diameter', () => {
    expect(radiusMatches).toHaveLength(1)
    expect(radius).toBe(0.45)
    const captains = squadSpawns(SQUADS, createRng(7)).filter((p) => p.kind === Kind.Captain)
    expect(SQUADS).toHaveLength(25)
    expect(captains).toHaveLength(9)
    const goals = [...SQUADS, ...captains]
    const grid = new ReachabilityGrid(PLAY_LIMIT, obstacles())
    expect(grid.reaches(PLAYER_START, goals, radius)).toEqual(goals.map(() => true))
    const width = grid.commonPathWidth(PLAYER_START, goals, radius)
    expect(width).toBeGreaterThanOrEqual(2 * radius)
    console.info(JSON.stringify({ schema: 'e11-layout/v1', targets: goals.length, radius, gridStep: grid.step, connectorReserve: grid.reserve, commonPathWidthLowerBound: width }))
  })

  it('rejects a blocked passage and accepts a passage wider than the player and sampling reserve', () => {
    const start = { x: 0, z: -2 }, goals = [{ x: 0, z: 2 }]
    expect(new ReachabilityGrid(3, gap(0.89)).reaches(start, goals, radius)).toEqual([false])
    expect(new ReachabilityGrid(3, gap(1.5)).reaches(start, goals, radius)).toEqual([true])
    expect(new ReachabilityGrid(3, gap(0.89)).commonPathWidth(start, goals, radius)).toBe(0)
  })

  it('checks the exact diameter analytically and never labels sampling uncertainty as a measured pass', () => {
    const centre = { x: 0, z: 0 }
    expect(clearanceAt(centre, 3, gap(0.9))).toBe(radius)
    expect(clearanceAt(centre, 3, gap(0.89))).toBeLessThan(radius)
    // Conservative sampling can reject an exactly fitting passage; it may not silently remove its reserve.
    expect(new ReachabilityGrid(3, gap(0.9)).reaches({ x: 0, z: -2 }, [{ x: 0, z: 2 }], radius)).toEqual([false])
  })

  it('rejects blocked starts, outside goals and a thin wall between grid rows', () => {
    const wall = [{ minX: -3, maxX: 3, minZ: 0.10, maxZ: 0.12 }]
    const grid = new ReachabilityGrid(3, wall)
    expect(grid.reaches({ x: 0, z: -2 }, [{ x: 0, z: 2 }], 0.02)).toEqual([false])
    expect(grid.reaches({ x: 0, z: 0.11 }, [{ x: 0, z: 2 }], radius)).toEqual([false])
    expect(grid.reaches({ x: 0, z: 2 }, [{ x: 4, z: 2 }], radius)).toEqual([false])
  })
})
