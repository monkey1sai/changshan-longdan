import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { CameraRig } from '../src/view/camera-rig.ts'

describe('CameraRig', () => {
  it('重開戰鬥立即重設移動方向，避免上一局視角殘留', () => {
    const rig = new CameraRig(1.6)
    rig.snap(new Vector3(), Math.PI / 2)
    expect(rig.forward.x).toBeCloseTo(1)
    expect(rig.right.z).toBeCloseTo(1)
  })
  it('回正平滑接近角色方向，手動轉向可中斷', () => {
    const rig = new CameraRig(1.6)
    rig.snap(new Vector3(), 0)
    rig.recenter(1)
    rig.update(1 / 60, new Vector3(), 0, 0, false, false, 0)
    expect(rig.yaw).toBeGreaterThan(0)
    expect(rig.yaw).toBeLessThan(1)
    rig.update(1 / 60, new Vector3(), 1, 0, false, false, 0)
    const turned = rig.yaw
    rig.update(1 / 60, new Vector3(), 0, 0, false, false, 0)
    expect(rig.yaw).toBe(turned)
  })
})
