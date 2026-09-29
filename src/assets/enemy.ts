import { Mesh, MeshStandardMaterial, SkinnedMesh, type Group } from 'three'
import type { EnemyStore } from '../entities/enemies.ts'
import type { ModelAsset } from './model.ts'

export const ENEMY_PARTS = ['legs', 'arms', 'torso', 'head', 'spear', 'sword', 'shield', 'plume'] as const
export type EnemyPart = (typeof ENEMY_PARTS)[number]
export interface EnemyPose {
  legR: number; legL: number; armRx: number; armLx: number; abduct: number
  lean: number; nod: number; tumble: number; lift: number; weapon: number
}
export interface EnemyAsset extends ModelAsset {
  /** One rigid Mesh per role, geometry authored around the role's local pivot. */
  parts: Readonly<Record<EnemyPart, string>>
}
export interface EnemyVisualOptions {
  model?: EnemyAsset
  animate?: (store: Readonly<EnemyStore>, index: number, time: number, pose: EnemyPose) => void
}
/** Validate the whole set before touching a live batch; no partial swaps. */
export function enemyMeshes(scene: Group, asset: EnemyAsset): Record<EnemyPart, Mesh> {
  const parts = {} as Record<EnemyPart, Mesh>
  for (const role of ENEMY_PARTS) {
    const object = scene.getObjectByName(asset.parts[role])
    if (!(object instanceof Mesh) || object instanceof SkinnedMesh || !(object.material instanceof MeshStandardMaterial)
      || !object.geometry.attributes.position || object.geometry.attributes.position.count === 0) {
      throw new Error(`敵人部件 ${role} 需要單一材質的非蒙皮 Mesh：${asset.parts[role]}`)
    }
    if (object.position.lengthSq() !== 0 || object.rotation.x !== 0 || object.rotation.y !== 0 || object.rotation.z !== 0
      || object.scale.x !== 1 || object.scale.y !== 1 || object.scale.z !== 1) {
      throw new Error(`敵人部件 ${role} 必須先套用物件變換`)
    }
    parts[role] = object
  }
  return parts
}
