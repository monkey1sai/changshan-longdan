import { Bone, Group, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from 'three'

/** Visual-only retargeting. Combat timing and spear coordinates stay in PlayerModel. */
export interface CharacterDrivers {
  hips: Object3D
  torso: Object3D
  head: Object3D
  upperL: Object3D
  upperR: Object3D
  foreL: Object3D
  foreR: Object3D
  thighL: Object3D
  thighR: Object3D
  kneeL: Object3D
  kneeR: Object3D
  spear: Object3D
}

interface Binding {
  bone: Bone
  driver: Object3D
  correction: Quaternion
  scale: Vector3
  translate: boolean
}

const DOWN = new Vector3(0, -1, 0)

export class CharacterSkin {
  readonly scene: Group
  private readonly bindings: Binding[] = []
  private readonly position = new Vector3()
  private readonly rotation = new Quaternion()
  private readonly world = new Matrix4()
  private readonly local = new Matrix4()
  private readonly palmY = new Vector3()
  private readonly palmZ = new Vector3()
  private readonly palmX = new Vector3()
  private readonly hands: { bone: Bone; fore: Object3D; side: number }[] = []
  private readonly spear: Object3D
  readonly triangles: number

  constructor(scene: Group, drivers: CharacterDrivers) {
    this.scene = scene
    this.spear = drivers.spear
    scene.updateMatrixWorld(true)
    const bones = new Map<string, Bone>()
    let triangles = 0
    scene.traverse((object) => {
      if (object instanceof Bone) bones.set(object.name, object)
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
        // The imported bounds describe the rest pose, not the retargeted attack.
        object.frustumCulled = false
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
      }
    })
    this.triangles = triangles
    const bone = (name: string): Bone => {
      const b = bones.get(name)
      if (!b) throw new Error(`趙雲骨架缺少 ${name}`)
      return b
    }
    const bind = (name: string, driver: Object3D, end?: string, length?: number, translate = true) => {
      const b = bone(name)
      const correction = b.getWorldQuaternion(new Quaternion())
      const scale = new Vector3(1, 1, 1)
      if (end) {
        const delta = bone(end).getWorldPosition(new Vector3()).sub(b.getWorldPosition(new Vector3()))
        if (delta.length() < 0.001) throw new Error(`趙雲骨架長度無效 ${name}`)
        if (length) scale.y = length / delta.length()
        correction.premultiply(new Quaternion().setFromUnitVectors(delta.normalize(), DOWN))
      }
      this.bindings.push({ bone: b, driver, correction, scale, translate })
    }
    // Parent before child: each transform is converted back into its parent's space.
    bind('pelvis', drivers.hips)
    bind('spine_03', drivers.torso, undefined, undefined, false)
    bind('Head', drivers.head, undefined, undefined, false)
    for (const [s, upper, fore, thigh, knee] of [
      ['l', drivers.upperL, drivers.foreL, drivers.thighL, drivers.kneeL],
      ['r', drivers.upperR, drivers.foreR, drivers.thighR, drivers.kneeR],
    ] as const) {
      bind(`upperarm_${s}`, upper, `lowerarm_${s}`, 0.32)
      // Palm extends the final 7 cm to the original IK grip endpoint.
      bind(`lowerarm_${s}`, fore, `hand_${s}`, 0.25)
      bind(`thigh_${s}`, thigh, `calf_${s}`, 0.46)
      bind(`calf_${s}`, knee, `foot_${s}`, 0.42)
      this.hands.push({ bone: bone(`hand_${s}`), fore, side: s === 'l' ? 1 : -1 })
    }
    // Close fingers around the shaft; preserve the supplied thumb opposition.
    for (const s of ['l', 'r']) {
      for (const finger of ['index', 'middle', 'ring', 'pinky']) {
        for (const n of ['01', '02', '03']) bone(`${finger}_${n}_${s}`).rotateX(n === '01' ? 0.9 : 1.15)
      }
    }
  }

  update(): void {
    for (const b of this.bindings) {
      b.bone.updateWorldMatrix(true, false)
      if (b.translate) b.driver.getWorldPosition(this.position)
      else b.bone.getWorldPosition(this.position)
      b.driver.getWorldQuaternion(this.rotation).multiply(b.correction)
      this.world.compose(this.position, this.rotation, b.scale)
      if (b.bone.parent) this.local.copy(b.bone.parent.matrixWorld).invert().multiply(this.world)
      else this.local.copy(this.world)
      this.local.decompose(b.bone.position, b.bone.quaternion, b.bone.scale)
      b.bone.updateMatrixWorld(true)
    }
    // Roll each palm around its forearm so the shaft crosses the palm, not its edge.
    for (const h of this.hands) {
      h.fore.getWorldQuaternion(this.rotation)
      this.palmY.copy(DOWN).applyQuaternion(this.rotation)
      this.spear.getWorldQuaternion(this.rotation)
      this.palmZ.set(0, 0, h.side).applyQuaternion(this.rotation)
      this.palmZ.addScaledVector(this.palmY, -this.palmZ.dot(this.palmY))
      if (this.palmZ.lengthSq() < .001) continue
      this.palmZ.normalize()
      this.palmX.crossVectors(this.palmY, this.palmZ).normalize()
      this.world.makeBasis(this.palmX, this.palmY, this.palmZ)
      h.bone.getWorldPosition(this.position)
      this.world.setPosition(this.position)
      this.local.copy(h.bone.parent!.matrixWorld).invert().multiply(this.world)
      this.local.decompose(h.bone.position, h.bone.quaternion, h.bone.scale)
      h.bone.updateMatrixWorld(true)
    }
  }
}
