import { BRAZIERS, obstacles, PLAY_LIMIT, PLAYER_START, SQUADS, type Rect } from './layout.ts'

/** 關卡資料是渲染與碰撞的共同來源；畫面與敵人不得各自猜建築座標。 */
export const LEVEL_IDS = ['fortress', 'moonlit-manor'] as const
export type LevelId = (typeof LEVEL_IDS)[number]

export const MANOR_HALL: Rect = { minX: -23, maxX: 23, minZ: -55, maxZ: -36 }
export const MANOR_HOUSES: readonly Rect[] = [
  { minX: -53, maxX: -40, minZ: -29, maxZ: -12 },
  { minX: 40, maxX: 53, minZ: -29, maxZ: -12 },
  { minX: -53, maxX: -40, minZ: 12, maxZ: 29 },
  { minX: 40, maxX: 53, minZ: 12, maxZ: 29 },
]

export const MANOR_FLOWERBEDS = [-1, 1].flatMap((side) =>
  Array.from({ length: 16 }, (_, index) => {
    const x = side * 11.2
    const z = -31 + index * 4.6
    return { x, z, rect: { minX: x - 1.7, maxX: x + 1.7, minZ: z - 1.75, maxZ: z + 1.75 } }
  }),
)
export const MANOR_LAMPS = [-28, -10, 10, 28].flatMap((x) => [-31, 30].map((z) => ({ x, z })))
export const MANOR_PEOPLE = [{ x: -8.5, z: 38 }, { x: 8.5, z: 38 }] as const

const MANOR_OBSTACLES: readonly Rect[] = [
  MANOR_HALL, ...MANOR_HOUSES,
  ...MANOR_FLOWERBEDS.map((bed) => bed.rect),
  ...MANOR_LAMPS.map(({ x, z }) => ({ minX: x - 0.23, maxX: x + 0.23, minZ: z - 0.23, maxZ: z + 0.23 })),
  ...MANOR_PEOPLE.map(({ x, z }) => ({ minX: x - 0.43, maxX: x + 0.43, minZ: z - 0.25, maxZ: z + 0.25 })),
]
const FORTRESS_OBSTACLES = obstacles()
const MANOR_SQUADS = [28, 14, 0, -14, -28].flatMap((z) => [-34, -18, 0, 18, 34].map((x) => ({ x, z })))

export function isLevelId(id: string): id is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(id)
}

export function levelObstacles(id: LevelId): readonly Rect[] {
  return id === 'fortress' ? FORTRESS_OBSTACLES : MANOR_OBSTACLES
}

export function levelSpawns(id: LevelId): readonly { x: number; z: number }[] {
  // 新舞台維持 25 隊密度，改以宅邸前的五道隊列迎戰。
  return id === 'fortress' ? SQUADS : MANOR_SQUADS
}

export { BRAZIERS, PLAY_LIMIT, PLAYER_START }
