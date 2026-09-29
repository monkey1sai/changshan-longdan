import { Color, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three'
import type { MoveId } from '../combat/moves.ts'
import { solveTwoBone } from '../core/ik.ts'
import { clamp, smoothstep, TAU } from '../core/math.ts'
import type { Player } from '../entities/player.ts'
import { VoxelBuilder } from '../world/voxel-builder.ts'
import { AIR, blankPose, copyPose, crossfade, DOWN, GUARD, HURT, mixPose, movePose, ROLL, RUN, STANCE } from './player-poses.ts'

const hex = (h: string) => new Color(h)
const Z = {
  silver: hex('#d4dade'),
  silverDark: hex('#9ea7b0'),
  gold: hex('#d1a84b'),
  green: hex('#2f7d4a'),
  greenDark: hex('#1f5a35'),
  white: hex('#e9e6dc'),
  skin: hex('#e0ae88'),
  hair: hex('#18130f'),
  red: hex('#c4302b'),
  boot: hex('#3b2a1f'),
  dark: hex('#141210'),
  lip: hex('#8a4a3a'),
  shaft: hex('#e3e4e8'),
}

const DOWN_AXIS = new Vector3(0, -1, 0)
const UPPER = 0.32
const LOWER = 0.32
const CAPE_SEGMENTS = 5
const CAPE_LENGTH = 0.3

/** 一個部位的金屬與布料方塊分開建成兩個網格，套用不同材質。 */
class PartBuilder {
  readonly metal = new VoxelBuilder()
  readonly cloth = new VoxelBuilder()

  build(metal: MeshStandardMaterial, cloth: MeshStandardMaterial): Group {
    const group = new Group()
    for (const [builder, material] of [[this.metal, metal], [this.cloth, cloth]] as const) {
      if (builder.vertexCount === 0) continue
      const mesh = new Mesh(builder.build(), material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
    return group
  }
}

const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()
const shoulderL = new Vector3()
const shoulderR = new Vector3()
const gripR = new Vector3()
const gripL = new Vector3()
const handL = new Vector3()
const elbow = new Vector3()
const hand = new Vector3()
const pole = new Vector3()
const axis = new Vector3()
const fwd = new Vector3()
const right = new Vector3()
const bx = new Vector3()
const by = new Vector3()
const bz = new Vector3()
const q = new Quaternion()
const rootQ = new Quaternion()
const basis = new Matrix4()

/** 趙雲的體素模型：姿勢驅動、雙臂 IK 握槍、披風以 Verlet 模擬。 */
export class PlayerModel {
  readonly group = new Group()
  /** 槍尖與槍身中段的世界座標，給刀光使用。 */
  readonly tip = new Vector3()
  readonly tipBase = new Vector3()
  private readonly root = new Group()
  private readonly hips = new Group()
  private readonly torso = new Group()
  private readonly head = new Group()
  private readonly thighL = new Group()
  private readonly thighR = new Group()
  private readonly kneeL = new Group()
  private readonly kneeR = new Group()
  private readonly spear = new Group()
  private readonly shoulderAnchorL = new Object3D()
  private readonly shoulderAnchorR = new Object3D()
  private readonly capeAnchor = new Object3D()
  private readonly upperL: Group
  private readonly foreL: Group
  private readonly upperR: Group
  private readonly foreR: Group
  private readonly cape: Group[] = []
  private readonly capePts: Vector3[] = []
  private readonly capePrev: Vector3[] = []
  private capeReady = false
  private readonly blade: MeshStandardMaterial
  private readonly pose = blankPose()
  private readonly from = blankPose()
  private readonly target = blankPose()
  private fade = 1
  private fadeTime = 0.1
  private lastKey = ''
  private lastMove: MoveId | null = null
  private lastMoveTime = 0

  constructor() {
    const metal = new MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.65 })
    const cloth = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 })
    this.blade = new MeshStandardMaterial({ color: '#eaf6ff', emissive: '#7cc8ff', emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.6 })

    this.group.add(this.root)
    this.root.add(this.hips)
    this.hips.add(this.buildHips().build(metal, cloth), this.torso, this.thighL, this.thighR, this.spear)
    this.torso.position.set(0, 0.02, 0)
    this.torso.add(this.buildTorso().build(metal, cloth), this.head, this.shoulderAnchorL, this.shoulderAnchorR, this.capeAnchor)
    this.head.position.set(0, 0.6, 0)
    this.head.add(this.buildHead().build(metal, cloth))
    this.shoulderAnchorL.position.set(0.3, 0.47, 0)
    this.shoulderAnchorR.position.set(-0.3, 0.47, 0)
    this.capeAnchor.position.set(0, 0.5, -0.18)

    for (const [thigh, knee, side] of [[this.thighL, this.kneeL, 1], [this.thighR, this.kneeR, -1]] as const) {
      thigh.position.set(0.12 * side, 0, 0)
      const leg = new PartBuilder()
      leg.cloth.box(0, -0.23, 0, 0.19, 0.46, 0.21, Z.white)
      thigh.add(leg.build(metal, cloth), knee)
      knee.position.set(0, -0.46, 0)
      const shin = new PartBuilder()
      shin.cloth.box(0, -0.2, 0, 0.17, 0.42, 0.19, Z.white)
      shin.metal.box(0, -0.2, 0.08, 0.18, 0.3, 0.05, Z.silver)
      shin.cloth.box(0, -0.43, 0.04, 0.21, 0.12, 0.3, Z.boot)
      knee.add(shin.build(metal, cloth))
    }

    this.spear.add(this.buildSpear().build(metal, cloth))
    const blade = new VoxelBuilder()
      .box(0, 0, 2.4, 0.1, 0.03, 0.46, Z.white)
      .box(0, 0, 2.68, 0.05, 0.025, 0.12, Z.white)
      .box(0, 0, 2.36, 0.02, 0.045, 0.4, Z.white)
    const bladeMesh = new Mesh(blade.build(), this.blade)
    bladeMesh.castShadow = true
    this.spear.add(bladeMesh)

    const upper = new PartBuilder()
    upper.cloth.box(0, -0.16, 0, 0.14, 0.32, 0.15, Z.green)
    upper.metal.box(0, -0.06, 0, 0.17, 0.16, 0.18, Z.silver)
    const fore = new PartBuilder()
    fore.metal.box(0, -0.15, 0, 0.14, 0.26, 0.15, Z.silver)
    fore.metal.box(0, -0.02, 0, 0.15, 0.04, 0.16, Z.gold)
    fore.cloth.box(0, -0.3, 0, 0.1, 0.1, 0.11, Z.skin)
    this.upperL = upper.build(metal, cloth)
    this.upperR = upper.build(metal, cloth)
    this.foreL = fore.build(metal, cloth)
    this.foreR = fore.build(metal, cloth)
    this.group.add(this.upperL, this.upperR, this.foreL, this.foreR)

    const capePiece = new PartBuilder()
    capePiece.cloth.box(0, -CAPE_LENGTH / 2, 0, 0.44, CAPE_LENGTH, 0.03, Z.white)
    capePiece.cloth.box(0, -CAPE_LENGTH + 0.02, 0, 0.45, 0.03, 0.035, Z.green)
    for (let i = 0; i < CAPE_SEGMENTS - 1; i++) {
      const seg = capePiece.build(metal, cloth)
      this.cape.push(seg)
      this.group.add(seg)
    }
    for (let i = 0; i < CAPE_SEGMENTS; i++) {
      this.capePts.push(new Vector3())
      this.capePrev.push(new Vector3())
    }
  }

  /** 瞬間移動（重新開局）後呼叫，避免披風被拉長。 */
  resetCape(): void {
    this.capeReady = false
  }

  update(player: Player, dt: number, time: number): void {
    const key = this.poseKey(player)
    if (key !== this.lastKey) {
      copyPose(this.from, this.pose)
      this.fade = 0
      this.fadeTime = key === 'move' || key === 'jump' ? 0.14 : 0.07
      this.lastKey = key
    }
    this.fade = Math.min(1, this.fade + dt / this.fadeTime)
    this.targetPose(player)
    if (this.fade < 1) crossfade(this.pose, this.from, this.target, smoothstep(0, 1, this.fade))
    else copyPose(this.pose, this.target)

    this.apply(player)
    this.solveArms(player)
    if (dt > 0) this.updateCape(dt, time) // 命中停頓時披風也要凍結

    const musou = player.state === 'musou'
    this.blade.emissive.set(musou ? '#ffc766' : '#7cc8ff')
    this.blade.emissiveIntensity = musou ? 4 + Math.sin(time * 30) * 1.2 : 1.8
    this.spear.localToWorld(this.tip.set(0, 0, 2.7))
    this.spear.localToWorld(this.tipBase.set(0, 0, 1.25))
  }

  private poseKey(player: Player): string {
    if ((player.state === 'attack' || player.state === 'musou') && player.move !== null) {
      const id = player.move.id
      const restarted = id === this.lastMove && player.moveTime < this.lastMoveTime
      this.lastMove = id
      this.lastMoveTime = player.moveTime
      if (restarted) return `${id}:${nextSerial()}`
      return this.lastKey.startsWith(`${id}:`) ? this.lastKey : `${id}:${nextSerial()}`
    }
    this.lastMove = null
    return player.state
  }

  private targetPose(player: Player): void {
    const t = this.target
    switch (player.state) {
      case 'move': {
        const run = smoothstep(0.3, 6.5, player.speed)
        mixPose(t, STANCE, RUN, run)
        t.crouch += Math.sin(player.runPhase * 2) * 0.035 * run
        break
      }
      case 'jump':
        copyPose(t, AIR)
        break
      case 'guard':
        copyPose(t, GUARD)
        break
      case 'attack':
      case 'musou':
        if (player.move !== null) movePose(player.move.id, player.moveTime, t)
        break
      case 'dodge':
        if (player.dodgeBack) {
          copyPose(t, HURT)
          t.lean = -0.15
        } else {
          copyPose(t, ROLL)
          t.flip = TAU * smoothstep(0.02, 0.36, player.stateTime)
          t.lean = 0.9
          t.crouch = -0.35
        }
        break
      case 'hurt':
        copyPose(t, HURT)
        break
      case 'down':
        mixPose(t, DOWN, STANCE, smoothstep(0.95, 1.3, player.stateTime))
        break
      case 'dead':
        copyPose(t, DOWN)
        break
    }
  }

  private apply(player: Player): void {
    const p = this.pose
    this.root.position.copy(player.pos)
    this.root.rotation.set(0, player.facing + p.spin, 0)
    const hipsY = 0.95 + p.crouch
    this.hips.position.set(0, hipsY, 0)
    this.hips.rotation.set(p.flip, 0, 0)
    this.torso.rotation.set(p.lean, p.twist, 0)
    this.head.rotation.set(-p.lean * 0.4, -p.twist * 0.5, 0)
    this.spear.position.set(p.gx, p.gy - hipsY, p.gz)
    this.spear.rotation.set(-p.pitch, p.yaw, p.roll, 'YXZ')

    // 腿：先讓膝蓋彎到腳能踩地，再疊上弓步與跑步擺動
    const airborne = player.pos.y > 0.25 && player.state !== 'down' && player.state !== 'dead'
    const lying = Math.abs(p.flip + Math.PI / 2) < 0.6
    let thighL: number
    let thighR: number
    let kneeL: number
    let kneeR: number
    if (airborne) {
      thighL = -1.0
      thighR = -0.35
      kneeL = 1.4
      kneeR = 0.9
    } else if (lying) {
      thighL = -0.1
      thighR = 0.05
      kneeL = 0.15
      kneeR = 0.1
    } else {
      const bend = 2 * Math.acos(clamp(hipsY / 0.95, 0.35, 1))
      const run = player.state === 'move' ? smoothstep(0.3, 6.5, player.speed) : 0
      const swing = Math.sin(player.runPhase) * 0.95 * run
      thighL = -bend / 2 - 0.35 * p.stance + swing
      thighR = -bend / 2 + 0.3 * p.stance - swing
      kneeL = bend + 0.25 * p.stance + Math.max(0, Math.sin(player.runPhase + 1.6)) * 1.1 * run
      kneeR = bend + 0.1 * p.stance + Math.max(0, -Math.sin(player.runPhase + 1.6)) * 1.1 * run
    }
    this.thighL.rotation.set(thighL, 0, 0.04)
    this.thighR.rotation.set(thighR, 0, -0.04)
    this.kneeL.rotation.set(kneeL, 0, 0)
    this.kneeR.rotation.set(kneeR, 0, 0)
    this.root.updateMatrixWorld(true)
  }

  private solveArms(player: Player): void {
    const p = this.pose
    this.shoulderAnchorL.getWorldPosition(shoulderL)
    this.shoulderAnchorR.getWorldPosition(shoulderR)
    this.root.getWorldQuaternion(rootQ)
    this.spear.localToWorld(gripR.set(0, 0, 0))
    this.spear.getWorldQuaternion(q)
    axis.set(0, 0, 1).applyQuaternion(q)

    // 左手握在槍身上離左肩最近的點；不握槍時自然擺在腰側
    const t = clamp(v1.subVectors(shoulderL, gripR).dot(axis), 0.25, 1.1)
    gripL.copy(gripR).addScaledVector(axis, t)
    const swing = player.state === 'move' ? Math.sin(player.runPhase) * 0.3 * smoothstep(0.3, 6.5, player.speed) : 0
    this.torso.localToWorld(v2.set(0.36, 0.12, 0.12 - swing))
    handL.lerpVectors(v2, gripL, clamp(p.lh, 0, 1))

    pole.set(-0.7, -0.6, -0.5).applyQuaternion(rootQ).add(shoulderR)
    solveTwoBone(shoulderR, gripR, pole, UPPER, LOWER, elbow, hand)
    this.placeBone(this.upperR, shoulderR, elbow)
    this.placeBone(this.foreR, elbow, hand)

    pole.set(0.7, -0.6, -0.5).applyQuaternion(rootQ).add(shoulderL)
    solveTwoBone(shoulderL, handL, pole, UPPER, LOWER, elbow, hand)
    this.placeBone(this.upperL, shoulderL, elbow)
    this.placeBone(this.foreL, elbow, hand)
  }

  private placeBone(bone: Group, from: Vector3, to: Vector3): void {
    bone.position.copy(from)
    v3.subVectors(to, from).normalize()
    bone.quaternion.setFromUnitVectors(DOWN_AXIS, v3)
  }

  private updateCape(dt: number, time: number): void {
    const step = Math.min(dt, 1 / 30)
    const pts = this.capePts
    const prev = this.capePrev
    this.capeAnchor.getWorldPosition(v1)
    this.torso.getWorldQuaternion(q)
    fwd.set(0, 0, 1).applyQuaternion(q)
    right.set(1, 0, 0).applyQuaternion(q)
    if (!this.capeReady || pts[0].distanceToSquared(v1) > 4) {
      for (let i = 0; i < pts.length; i++) {
        pts[i].copy(v1).addScaledVector(fwd, -0.05 * i)
        pts[i].y -= CAPE_LENGTH * i
        prev[i].copy(pts[i])
      }
      this.capeReady = true
    }
    pts[0].copy(v1)
    for (let i = 1; i < pts.length; i++) {
      v2.subVectors(pts[i], prev[i]).multiplyScalar(0.9)
      prev[i].copy(pts[i])
      pts[i].add(v2)
      pts[i].y -= 9.8 * step * step
      pts[i].x += 2.2 * step * step * (1 + Math.sin(time * 3.1 + i))
      pts[i].z += 0.6 * step * step * Math.sin(time * 2.3 + i * 1.7)
    }
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 1; i < pts.length; i++) {
        v2.subVectors(pts[i], pts[i - 1])
        const len = v2.length() || 1e-4
        pts[i].copy(pts[i - 1]).addScaledVector(v2, CAPE_LENGTH / len)
        v3.subVectors(pts[i], v1)
        const front = v3.dot(fwd)
        const limit = -0.07 * i
        if (front > limit) pts[i].addScaledVector(fwd, limit - front)
        if (pts[i].y < 0.05) pts[i].y = 0.05
      }
    }
    for (let i = 0; i < this.cape.length; i++) {
      const seg = this.cape[i]
      seg.position.copy(pts[i])
      by.subVectors(pts[i], pts[i + 1]).normalize()
      bx.copy(right).addScaledVector(by, -right.dot(by)).normalize()
      bz.crossVectors(bx, by)
      basis.makeBasis(bx, by, bz)
      seg.quaternion.setFromRotationMatrix(basis)
    }
  }

  private buildHips(): PartBuilder {
    const b = new PartBuilder()
    b.cloth.box(0, -0.02, 0, 0.4, 0.16, 0.28, Z.white)
    b.cloth.box(0.21, -0.14, 0, 0.04, 0.3, 0.28, Z.green)
    b.cloth.box(-0.21, -0.14, 0, 0.04, 0.3, 0.28, Z.green)
    b.cloth.box(0, -0.3, 0.17, 0.2, 0.32, 0.02, Z.greenDark)
    b.metal.box(0, -0.12, 0.15, 0.4, 0.3, 0.04, Z.silver)
    b.metal.box(0, -0.12, -0.15, 0.4, 0.3, 0.04, Z.silver)
    b.metal.box(0, -0.26, 0.155, 0.41, 0.03, 0.045, Z.gold)
    return b
  }

  private buildTorso(): PartBuilder {
    const b = new PartBuilder()
    b.cloth.box(0, 0.12, 0, 0.4, 0.22, 0.26, Z.green)
    b.cloth.box(0, 0.57, 0, 0.28, 0.08, 0.24, Z.green)
    b.metal.box(0, 0.37, 0, 0.48, 0.34, 0.3, Z.silver)
    // 胸甲的魚鱗片與雙層金邊，讓遠景仍能分辨白袍銀甲的英雄輪廓。
    for (const y of [0.26, 0.38, 0.5]) {
      b.metal.box(0, y, 0.17, 0.34, 0.035, 0.025, Z.silverDark)
      b.metal.box(0, y + 0.012, 0.19, 0.09, 0.045, 0.025, Z.gold)
    }
    b.metal.box(0, 0.38, 0.155, 0.3, 0.2, 0.02, Z.silverDark)
    b.metal.box(0, 0.4, 0.168, 0.1, 0.1, 0.01, Z.gold)
    b.metal.box(0, 0.36, -0.155, 0.4, 0.3, 0.02, Z.silverDark)
    b.metal.box(0, 0.02, 0, 0.46, 0.07, 0.3, Z.gold)
    for (const s of [-1, 1]) {
      b.metal.box(s * 0.31, 0.5, 0, 0.2, 0.12, 0.28, Z.silver)
      b.metal.box(s * 0.31, 0.44, 0, 0.21, 0.03, 0.29, Z.gold)
    }
    return b
  }

  private buildHead(): PartBuilder {
    const b = new PartBuilder()
    b.cloth.box(0, 0.05, 0, 0.12, 0.1, 0.12, Z.skin)
    b.cloth.box(0, 0.22, 0, 0.26, 0.28, 0.26, Z.skin)
    b.cloth.box(0, 0.26, -0.1, 0.28, 0.24, 0.1, Z.hair)
    for (const s of [-1, 1]) {
      b.cloth.box(s * 0.135, 0.24, -0.02, 0.03, 0.18, 0.18, Z.hair)
      b.cloth.box(s * 0.06, 0.23, 0.131, 0.05, 0.035, 0.01, Z.dark)
      b.cloth.box(s * 0.06, 0.27, 0.132, 0.07, 0.02, 0.01, Z.hair)
      b.cloth.box(s * 0.05, 0.18, -0.2, 0.04, 0.32, 0.02, Z.green)
      b.metal.box(s * 0.145, 0.25, 0.03, 0.02, 0.14, 0.14, Z.silver)
    }
    b.cloth.box(0, 0.13, 0.131, 0.06, 0.015, 0.01, Z.lip)
    b.cloth.box(0, 0.33, -0.15, 0.24, 0.05, 0.04, Z.green)
    b.cloth.box(0, 0.5, -0.02, 0.08, 0.14, 0.08, Z.red)
    b.cloth.box(0, 0.6, -0.08, 0.07, 0.12, 0.1, Z.red)
    b.cloth.box(0, 0.64, -0.18, 0.06, 0.08, 0.14, Z.red)
    // 銀盔長翎：不新增物件，直接併入頭部既有的體素網格。
    b.cloth.box(0, 0.78, -0.1, 0.055, 0.22, 0.08, Z.white)
    b.cloth.box(0, 0.91, -0.16, 0.045, 0.12, 0.12, Z.white)
    b.cloth.box(0, 0.7, -0.08, 0.08, 0.035, 0.14, Z.red)
    b.metal.box(0, 0.37, 0, 0.3, 0.12, 0.3, Z.silver)
    b.metal.box(0, 0.32, 0.03, 0.31, 0.04, 0.3, Z.gold)
    b.metal.box(0, 0.41, 0.15, 0.12, 0.12, 0.04, Z.gold)
    return b
  }

  private buildSpear(): PartBuilder {
    const b = new PartBuilder()
    b.metal.box(0, 0, 0.55, 0.05, 0.05, 3.1, Z.shaft)
    for (const z of [-0.5, 0.5, 1.4]) b.metal.box(0, 0, z, 0.07, 0.07, 0.06, Z.gold)
    b.metal.box(0, 0, -1.05, 0.08, 0.08, 0.12, Z.gold)
    b.metal.box(0, 0, 2.12, 0.12, 0.12, 0.1, Z.gold)
    b.metal.box(0, 0, 2.27, 0.17, 0.045, 0.13, Z.gold)
    b.cloth.box(0, -0.04, 2.0, 0.16, 0.18, 0.1, Z.red)
    b.cloth.box(0, -0.16, 1.96, 0.1, 0.14, 0.06, Z.red)
    return b
  }
}

// 動作識別用的遞增序號，讓同一招連續出兩次時也會重新淡入
let serial = 0
function nextSerial(): number {
  return ++serial
}
