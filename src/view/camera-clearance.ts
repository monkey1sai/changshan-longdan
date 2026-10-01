import { BARRACKS, BARRACKS_ROOF_OVERHANG, PLAY_LIMIT, obstacles, type Rect } from '../world/layout.ts'

const ROOFS = BARRACKS.map((r) => ({
  minX: r.minX - BARRACKS_ROOF_OVERHANG,
  maxX: r.maxX + BARRACKS_ROOF_OVERHANG,
  minZ: r.minZ - BARRACKS_ROOF_OVERHANG,
  maxZ: r.maxZ + BARRACKS_ROOF_OVERHANG,
}))
const BLOCKERS = [...obstacles().filter((r) => !BARRACKS.includes(r)), ...ROOFS]

function inside(rect: Rect, x: number, z: number, margin: number): boolean {
  return x >= rect.minX - margin && x <= rect.maxX + margin && z >= rect.minZ - margin && z <= rect.maxZ + margin
}

/** focus 可以走進屋簷下；收短後仍須將相機推出屋簷，保留近裁切面與震動空間。 */
export function clearCameraOverhang(position: { x: number; z: number }, margin = 0.35): void {
  for (const r of ROOFS) {
    if (!inside(r, position.x, position.z, margin)) continue
    const left = position.x - r.minX + margin
    const right = r.maxX + margin - position.x
    const front = position.z - r.minZ + margin
    const back = r.maxZ + margin - position.z
    const nearest = Math.min(left, right, front, back)
    if (nearest === left) position.x = r.minX - margin
    else if (nearest === right) position.x = r.maxX + margin
    else if (nearest === front) position.z = r.minZ - margin
    else position.z = r.maxZ + margin
  }
}

/**
 * 回傳 focus→camera 可保留的最大比例。用固定取樣避免第三人稱鏡頭穿過城牆、營房與場景障礙。
 * 設計概念參考 MIT 專案 voxel-musou 的 camera clearance，但改為使用本專案共用的 layout obstacle 資料。
 */
export function cameraClearance(
  fx: number,
  fz: number,
  cx: number,
  cz: number,
  samples = 16,
  margin = 0.35,
): number {
  const edge = PLAY_LIMIT - margin
  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const x = fx + (cx - fx) * t
    const z = fz + (cz - fz) * t
    if (Math.abs(x) > edge || Math.abs(z) > edge || BLOCKERS.some((rect) => inside(rect, x, z, margin))) {
      return (i - 1) / samples
    }
  }
  return 1
}
