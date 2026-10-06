import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { InputFrame } from '../src/core/input.ts'
import type { PlayerControls } from '../src/entities/player.ts'
import { CameraRig, toPlayerControls } from '../src/view/camera-rig.ts'

const frame = (extra: Partial<InputFrame>): InputFrame => ({
  moveX: 0, moveY: 0, camTurn: 0, zoom: 0, attack: false, charge: false, jump: false,
  dodge: false, musou: false, pause: false, confirm: false, debug: false, ...extra,
})
const controls = (): PlayerControls => ({ moveX: 9, moveZ: 9, attack: true, charge: true, jump: true, dodge: true, musou: true, guard: true })

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

  it.each([
    ['南牆', new Vector3(0, 0, 54.55), Math.PI],
    ['東牆', new Vector3(54.55, 0, 40), -Math.PI / 2],
    ['營房', new Vector3(38.9, 0, 0), -Math.PI / 2],
  ])('靠近%s收短鏡頭時仍保持俯視高度', (_name, target, yaw) => {
    const rig = new CameraRig(1.6)
    rig.snap(target, yaw)
    for (let frame = 0; frame < 360; frame++) {
      rig.update(1 / 60, target, 0, 0, false, false, frame / 60)
    }
    expect(Math.hypot(rig.camera.position.x - target.x, rig.camera.position.z - target.z)).toBeLessThan(rig.distance)
    expect(rig.camera.position.y - rig.focus.y).toBeCloseTo(4.4)
    expect(Math.abs(rig.camera.position.x)).toBeLessThan(56)
    expect(Math.abs(rig.camera.position.z)).toBeLessThan(56)
  })

  it('開闊區域保持原本鏡頭距離與高度', () => {
    const rig = new CameraRig(1.6)
    const target = new Vector3()
    rig.snap(target, Math.PI)
    for (let frame = 0; frame < 360; frame++) {
      rig.update(1 / 60, target, 0, 0, false, false, frame / 60)
    }
    expect(rig.camera.position.z).toBeCloseTo(9.2)
    expect(rig.camera.position.y - rig.focus.y).toBeCloseTo(4.4)
  })

  it.each([
    [new Vector3(48.5, 0, 13.55), Math.PI],
    [new Vector3(39.55, 0, 0), -Math.PI / 2],
    [new Vector3(-39.55, 0, 0), Math.PI / 2],
  ])('緊貼屋簷時相機保持在外側，畫面上方仍與移動前方一致', (target, yaw) => {
    const rig = new CameraRig(1.6)
    rig.snap(target, yaw)
    for (let frame = 0; frame < 360; frame++) {
      rig.update(1 / 60, target, 0, 0, false, false, frame / 60)
    }
    // 營房屋簷最遠超出牆身 1.225m；鏡頭需再留出近裁切面的餘裕。
    if (target.x > 40) expect(rig.camera.position.z).toBeLessThan(12.5)
    else expect(Math.abs(rig.camera.position.x)).toBeLessThan(38.5)
    rig.camera.updateMatrixWorld()
    const ahead = rig.focus.clone().addScaledVector(rig.forward, 2).project(rig.camera)
    expect(ahead.y).toBeGreaterThan(0)
    expect(Math.abs(ahead.x)).toBeLessThan(0.001)
  })

  it.each([0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2])('營房角落避障後移動前方仍投影至畫面上方（yaw=%s）', (yaw) => {
    const rig = new CameraRig(4 / 3)
    const target = new Vector3(39.6, 0, 13.6)
    rig.snap(target, yaw)
    for (let frame = 0; frame < 360; frame++) rig.update(1 / 60, target, 0, 0, false, false, frame / 60)
    rig.camera.updateMatrixWorld()
    const center = rig.focus.clone().project(rig.camera)
    const ahead = rig.focus.clone().addScaledVector(rig.forward, 1).project(rig.camera)
    expect(ahead.y).toBeGreaterThan(center.y)
    expect(rig.camera.position.x < 38.5 || rig.camera.position.z < 12.5).toBe(true)
  })
})

describe('toPlayerControls', () => {
  it('搖桿方向依鏡頭轉成世界方向', () => {
    const rig = new CameraRig(1.6)
    rig.snap(new Vector3(), Math.PI / 2)
    const out = toPlayerControls(frame({ moveY: 1 }), rig.forward, rig.right, controls())
    expect(out.moveX).toBeCloseTo(1)
    expect(out.moveZ).toBeCloseTo(0)
    toPlayerControls(frame({ moveX: 1 }), rig.forward, rig.right, out)
    expect(out.moveX).toBeCloseTo(0)
    expect(out.moveZ).toBeCloseTo(1)
  })

  it('斜向移動長度不超過 1，按鍵逐項帶入', () => {
    const rig = new CameraRig(1.6)
    rig.snap(new Vector3(), 0)
    const out = toPlayerControls(frame({ moveX: 1, moveY: 1, attack: true, guard: true }), rig.forward, rig.right, controls())
    expect(Math.hypot(out.moveX, out.moveZ)).toBeCloseTo(1)
    expect(out).toMatchObject({ attack: true, charge: false, jump: false, dodge: false, musou: false, guard: true })
    toPlayerControls(frame({ moveX: 0.3 }), rig.forward, rig.right, out)
    expect(Math.hypot(out.moveX, out.moveZ)).toBeCloseTo(0.3)
    expect(out.guard).toBe(false)
  })
})
