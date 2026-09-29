import type { Group, MeshStandardMaterial } from 'three'
import type { ModelAsset } from './model.ts'
import { refinedSpear } from '../view/player-equipment.ts'

export interface HumanoidRig {
  hips: string
  torso: string
  head: string
  left: { upper: string; fore: string; hand: string; thigh: string; knee: string; foot: string }
  right: { upper: string; fore: string; hand: string; thigh: string; knee: string; foot: string }
  fingers: readonly { name: string; curl: number }[]
}
export const QUATERNIUS_RIG: HumanoidRig = {
  hips: 'pelvis', torso: 'spine_03', head: 'Head',
  left: { upper: 'upperarm_l', fore: 'lowerarm_l', hand: 'hand_l', thigh: 'thigh_l', knee: 'calf_l', foot: 'foot_l' },
  right: { upper: 'upperarm_r', fore: 'lowerarm_r', hand: 'hand_r', thigh: 'thigh_r', knee: 'calf_r', foot: 'foot_r' },
  fingers: ['l', 'r'].flatMap((side) => ['index', 'middle', 'ring', 'pinky'].flatMap((finger) =>
    ['01', '02', '03'].map((n) => ({ name: `${finger}_${n}_${side}`, curl: n === '01' ? .9 : 1.15 })))),
}
export interface CharacterAsset extends ModelAsset { rig: HumanoidRig }
export const ZHAOYUN: CharacterAsset = { path: 'models/zhaoyun.glb', rig: QUATERNIUS_RIG }
export interface WeaponAsset {
  model?: ModelAsset
  /** Visual sockets in local metres (+Z forward); combat reach is independent. */
  gripLeftRange: readonly [number, number]
  gripRight: number
  tip: number
  trailBase: number
  createFallback(blade: MeshStandardMaterial): Group
}
export const LONGDAN_SPEAR: WeaponAsset = {
  gripLeftRange: [.25, 1.1], gripRight: 0, tip: 2.7, trailBase: 1.25, createFallback: refinedSpear,
}
