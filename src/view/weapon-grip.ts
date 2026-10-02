import { Vector3 } from 'three'
import { clamp } from '../core/math.ts'

const offset = new Vector3()
const correction = new Vector3()
/** Visual IK constraint; combat range, timing and Player position are unchanged. */
export function fitWeaponGrip(
  right: Vector3, left: Vector3, axis: Vector3, shoulderR: Vector3, shoulderL: Vector3,
  reach: number, twoHands: boolean,
): void {
  for (let i = 0; i < (twoHands ? 12 : 1); i++) {
    offset.subVectors(right, shoulderR)
    const distance = offset.length()
    if (distance > reach) right.copy(shoulderR).addScaledVector(offset, reach / distance)
    const along = clamp(offset.subVectors(shoulderL, right).dot(axis), .18, 1.1)
    left.copy(right).addScaledVector(axis, along)
    if (!twoHands) break
    offset.subVectors(left, shoulderL)
    const leftDistance = offset.length()
    if (leftDistance <= reach) break
    correction.copy(shoulderL).addScaledVector(offset, reach / leftDistance).sub(left)
    right.add(correction)
  }
  // Final projection tolerates numerical drift without changing the spear axis.
  const along = clamp(offset.subVectors(shoulderL, right).dot(axis), .18, 1.1)
  left.copy(right).addScaledVector(axis, along)
}
