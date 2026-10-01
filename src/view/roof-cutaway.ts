import { BARRACKS, BARRACKS_ROOF_OVERHANG, ROOF_CUTAWAY_ENTER, ROOF_CUTAWAY_EXIT } from '../world/layout.ts'

/** 玩家進入屋簷時剖開該屋頂；退出範圍稍大，避免邊緣來回閃爍。碰撞維持不變。 */
export function updateRoofCutaway(roofs: readonly { visible: boolean }[], x: number, z: number, title: boolean): void {
  for (let i = 0; i < roofs.length; i++) {
    const roof = roofs[i]
    const rect = BARRACKS[i]
    const margin = BARRACKS_ROOF_OVERHANG + (roof.visible ? ROOF_CUTAWAY_ENTER : ROOF_CUTAWAY_EXIT)
    const near = x >= rect.minX - margin && x <= rect.maxX + margin && z >= rect.minZ - margin && z <= rect.maxZ + margin
    roof.visible = title || !near
  }
}
