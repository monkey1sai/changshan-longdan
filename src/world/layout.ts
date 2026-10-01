/** 城池配置：渲染與碰撞共用同一份座標，單位公尺，y 朝上，南門在 +z。 */

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export const INNER = 56 // 城牆內側面
export const WALL_THICK = 6
export const WALL_HEIGHT = 9
export const PLAY_LIMIT = INNER - 1 // 角色可活動的邊界
export const GATE_HALF = 6

export const KEEP: Rect & { height: number } = { minX: -20, maxX: 20, minZ: -55, maxZ: -31, height: 2.6 }
export const STAIRS: Rect = { minX: -6, maxX: 6, minZ: -31, maxZ: -26.5 }

export const BARRACKS: Rect[] = [
  { minX: 40, maxX: 53, minZ: -28, maxZ: -13 },
  { minX: 40, maxX: 53, minZ: -6, maxZ: 7 },
  { minX: 40, maxX: 53, minZ: 14, maxZ: 28 },
  { minX: -53, maxX: -40, minZ: -28, maxZ: -13 },
  { minX: -53, maxX: -40, minZ: -6, maxZ: 7 },
  { minX: -53, maxX: -40, minZ: 14, maxZ: 28 },
]

// 屋簷外框供幾何與相機共用；玩家仍以牆身矩形碰撞。
export const BARRACKS_ROOF_PADDING = 1.6
export const ROOF_TRIM_PADDING = 0.5
export const ROOF_CORNER_OFFSET = 0.15
export const ROOF_CORNER_SIZE = 0.55
export const BARRACKS_ROOF_OVERHANG = BARRACKS_ROOF_PADDING / 2 + Math.max(ROOF_TRIM_PADDING / 2, ROOF_CORNER_OFFSET + ROOF_CORNER_SIZE / 2)

export const BRAZIERS: { x: number; z: number }[] = [
  ...[40, 26, 12, -2, -16].flatMap((z) => [{ x: -8, z }, { x: 8, z }]),
  { x: -11, z: -28.5 },
  { x: 11, z: -28.5 },
  { x: -38, z: 10.5 },
  { x: 38, z: 10.5 },
  { x: -38, z: -9.5 },
  { x: 38, z: -9.5 },
]

/** 燃燒中的屋頂與殘骸。 */
export const BIG_FIRES: { x: number; y: number; z: number; scale: number }[] = [
  { x: 46.5, y: 7.4, z: 21, scale: 3.2 },
  { x: -46.5, y: 7.4, z: -20.5, scale: 3 },
  { x: -30, y: 0.4, z: 44, scale: 2.4 },
  { x: 36, y: 0.4, z: -47, scale: 2.2 },
]

export const WRECKS: Rect[] = BIG_FIRES.filter((f) => f.y < 1).map((f) => ({
  minX: f.x - 2.2,
  maxX: f.x + 2.2,
  minZ: f.z - 2.2,
  maxZ: f.z + 2.2,
}))

export const PLAYER_START = { x: 0, z: 42, facing: Math.PI }

/** 25 個魏軍小隊的中心；每隊 12 人，合計 300。 */
export const SQUADS: { x: number; z: number }[] = [
  ...[24, 10, -4, -18].flatMap((z) => [-34, -17, 0, 17, 34].map((x) => ({ x, z }))),
  { x: -30, z: -42 },
  { x: 28, z: -43 },
  { x: -26, z: 34 },
  { x: 26, z: 34 },
  { x: 0, z: -23.5 },
]

export function obstacles(): Rect[] {
  const braziers = BRAZIERS.map((b) => ({ minX: b.x - 0.6, maxX: b.x + 0.6, minZ: b.z - 0.6, maxZ: b.z + 0.6 }))
  return [KEEP, STAIRS, ...BARRACKS, ...WRECKS, ...braziers]
}
