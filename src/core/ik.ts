import { Vector3 } from 'three'

const dir = new Vector3()
const bend = new Vector3()

/**
 * 兩節骨骼 IK：給定根（肩）、目標（手）與極點（手肘偏好的方向），求出手肘與末端位置。
 * 目標超出臂長時手臂伸直指向目標。
 */
export function solveTwoBone(
  root: Vector3,
  target: Vector3,
  pole: Vector3,
  upper: number,
  lower: number,
  outElbow: Vector3,
  outEnd: Vector3,
): void {
  dir.subVectors(target, root)
  const dist = Math.min(Math.max(dir.length(), 1e-4), upper + lower - 1e-4)
  dir.normalize()
  const cosA = (upper * upper + dist * dist - lower * lower) / (2 * upper * dist)
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)))

  bend.subVectors(pole, root)
  bend.addScaledVector(dir, -bend.dot(dir))
  if (bend.lengthSq() < 1e-8) {
    bend.set(0, -1, 0)
    bend.addScaledVector(dir, -bend.dot(dir))
    if (bend.lengthSq() < 1e-8) bend.set(1, 0, 0)
  }
  bend.normalize()

  outElbow.copy(root).addScaledVector(dir, upper * Math.cos(a)).addScaledVector(bend, upper * Math.sin(a))
  outEnd.copy(root).addScaledVector(dir, dist)
}
