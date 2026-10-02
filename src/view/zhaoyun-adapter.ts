import { Bone, Group, Matrix4, Mesh, Object3D, Quaternion, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/** All inspected source-asset names and bind-pose assumptions live here. */
export const ZHAOYUN_ASSET = {
  id: 'user-zhaoyun-c8dff5', path: 'models/zhaoyun.glb', mesh: 'SM_ZhaoYun', weapon: 'SM_ZhaoYunSpear',
  bones: ['pelvis', 'spine_01', 'spine_03', 'neck', 'head',
    'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r',
    'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r', 'cape_01', 'cape_02', 'skirt_l', 'skirt_r'],
} as const
export const ZHAOYUN_DIMENSIONS = {
  upperArm: .32, lowerArm: .32, upperLeg: .46, lowerLeg: .42,
  soleAnchorY: .089, runPhaseScale: 2.6, spearTipZ: 2.7, spearTrailBaseZ: 1.25,
} as const
export interface CharacterDrivers {
  hips: Object3D; torso: Object3D; head: Object3D
  upperL: Object3D; upperR: Object3D; foreL: Object3D; foreR: Object3D
  thighL: Object3D; thighR: Object3D; kneeL: Object3D; kneeR: Object3D
  handL: Object3D; handR: Object3D; spear: Object3D
  footL: Object3D; footR: Object3D; capeTop: Object3D; capeLower: Object3D
}
interface Binding { bone: Bone; driver: Object3D; correction: Quaternion; scale: Vector3; translate: boolean }
const DOWN = new Vector3(0, -1, 0)
const SOURCE_SHAFT = new Vector3(-1.416, 1.695, 0.024).normalize()

/** Bind-pose correction and IK. No separate clock or root-motion displacement. */
export class ZhaoYunSkin {
  readonly scene: Group
  private readonly drivers: CharacterDrivers
  readonly triangles: number
  readonly weapon: Object3D
  private readonly bindings: Binding[] = []
  private readonly position = new Vector3()
  private readonly rotation = new Quaternion()
  private readonly freeRotation = new Quaternion()
  private readonly world = new Matrix4()
  private readonly local = new Matrix4()
  private readonly unitScale = new Vector3(1, 1, 1)
  private readonly hands: { bone: Bone; driver: Object3D; fore: Object3D; correction: Quaternion; left: boolean }[] = []
  private readonly feet: { bone: Bone; correction: Quaternion; driver: Object3D }[] = []
  constructor(scene: Group, drivers: CharacterDrivers) {
    this.scene = scene
    this.drivers = drivers
    scene.updateMatrixWorld(true)
    const bones = new Map<string, Bone>()
    let triangles = 0
    scene.traverse((object) => {
      if (object instanceof Bone) bones.set(object.name, object)
      if (object instanceof Mesh) {
        object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
      }
    })
    if (!(scene.getObjectByName(ZHAOYUN_ASSET.mesh) instanceof Mesh)) throw new Error('趙雲網格不存在')
    const weapon = scene.getObjectByName(ZHAOYUN_ASSET.weapon)
    let weaponVertices = 0
    weapon?.traverse(o => { if (o instanceof Mesh) weaponVertices += o.geometry.getAttribute('position').count })
    if (!weapon || weaponVertices === 0) throw new Error('趙雲長槍不存在')
    this.weapon = weapon; this.triangles = triangles
    const bone = (name: string): Bone => {
      const b = bones.get(name)
      if (!b) throw new Error(`趙雲骨架缺少 ${name}`)
      return b
    }
    for (const name of ZHAOYUN_ASSET.bones) bone(name)
    const bind = (name: string, driver: Object3D, end?: string, length?: number, translate = true) => {
      const b = bone(name), correction = b.getWorldQuaternion(new Quaternion()), scale = new Vector3(1, 1, 1)
      if (end) {
        const delta = bone(end).getWorldPosition(new Vector3()).sub(b.getWorldPosition(new Vector3()))
        if (delta.length() < .001) throw new Error(`趙雲骨架長度無效 ${name}`)
        if (length) scale.y = length / delta.length()
        correction.premultiply(new Quaternion().setFromUnitVectors(delta.normalize(), DOWN))
      }
      this.bindings.push({ bone: b, driver, correction, scale, translate })
    }
    bind('pelvis', drivers.hips)
    bind('spine_03', drivers.torso, undefined, undefined, false)
    bind('head', drivers.head, undefined, undefined, false)
    for (const [s, upper, fore, thigh, knee, hand, left] of [
      ['l', drivers.upperL, drivers.foreL, drivers.thighL, drivers.kneeL, drivers.handL, true],
      ['r', drivers.upperR, drivers.foreR, drivers.thighR, drivers.kneeR, drivers.handR, false],
    ] as const) {
      bind(`upperarm_${s}`, upper, `lowerarm_${s}`, ZHAOYUN_DIMENSIONS.upperArm)
      bind(`lowerarm_${s}`, fore, `hand_${s}`, ZHAOYUN_DIMENSIONS.lowerArm)
      bind(`thigh_${s}`, thigh, `calf_${s}`, ZHAOYUN_DIMENSIONS.upperLeg)
      bind(`calf_${s}`, knee, `foot_${s}`, ZHAOYUN_DIMENSIONS.lowerLeg)
      const h = bone(`hand_${s}`)
      const correction = new Quaternion().setFromUnitVectors(SOURCE_SHAFT, new Vector3(0, 0, 1)).multiply(h.getWorldQuaternion(new Quaternion()))
      this.hands.push({ bone: h, driver: hand, fore, correction, left })
      const foot = bone(`foot_${s}`)
      this.feet.push({ bone: foot, correction: foot.getWorldQuaternion(new Quaternion()), driver: s === 'l' ? drivers.footL : drivers.footR })
    }
    bind('cape_01', drivers.capeTop, 'cape_02', .60)
    bind('cape_02', drivers.capeLower)
  }
  update(support = 1): void {
    for (const b of this.bindings) {
      b.bone.updateWorldMatrix(true, false)
      if (b.translate) b.driver.getWorldPosition(this.position)
      else b.bone.getWorldPosition(this.position)
      b.driver.getWorldQuaternion(this.rotation).multiply(b.correction)
      this.world.compose(this.position, this.rotation, b.scale); this.place(b.bone)
    }
    for (const h of this.hands) {
      h.driver.getWorldPosition(this.position)
      this.drivers.spear.getWorldQuaternion(this.rotation).multiply(h.correction)
      if (h.left && support < 1) {
        h.fore.getWorldQuaternion(this.freeRotation).multiply(h.correction)
        this.rotation.slerp(this.freeRotation, 1 - support)
      }
      this.world.compose(this.position, this.rotation, this.unitScale); this.place(h.bone)
    }
    for (const foot of this.feet) {
      foot.driver.getWorldPosition(this.position)
      this.drivers.hips.getWorldQuaternion(this.rotation).multiply(foot.correction)
      this.world.compose(this.position, this.rotation, this.unitScale); this.place(foot.bone)
    }
    this.scene.updateMatrixWorld(true)
  }
  private place(bone: Bone): void {
    if (bone.parent) this.local.copy(bone.parent.matrixWorld).invert().multiply(this.world)
    else this.local.copy(this.world)
    this.local.decompose(bone.position, bone.quaternion, bone.scale); bone.updateMatrixWorld(true)
  }
}

export class ZhaoYunAdapter {
  private readonly parent: Group
  private readonly drivers: CharacterDrivers
  state: 'loading' | 'ready' | 'failed' | 'disposed' = 'loading'
  error: string | null = null
  skin: ZhaoYunSkin | null = null
  private scene: Group | null = null
  private readonly fallback: Mesh[] = []
  constructor(parent: Group, drivers: CharacterDrivers) {
    this.parent = parent
    this.drivers = drivers
    parent.traverse((o) => { if (o instanceof Mesh) this.fallback.push(o) })
  }
  async load(): Promise<void> {
    let loaded: Group | null = null
    try {
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${ZHAOYUN_ASSET.path}`)
      loaded = gltf.scene
      if (this.state === 'disposed') { disposeScene(loaded); return }
      const skin = new ZhaoYunSkin(loaded, this.drivers)
      this.scene = loaded; this.skin = skin
      this.parent.add(loaded); this.drivers.spear.add(skin.weapon); skin.update()
      for (const mesh of this.fallback) mesh.visible = false
      this.state = 'ready'
    } catch (error) {
      if (loaded) disposeScene(loaded)
      if (this.state === 'disposed') return
      this.state = 'failed'; this.error = error instanceof Error ? error.message : String(error)
      console.error(`趙雲模型載入失敗（程序模型回退不能當驗收通過）：${this.error}`)
    }
  }
  update(support: number): void { this.skin?.update(support) }
  dispose(): void {
    this.state = 'disposed'
    if (this.skin) { this.skin.weapon.removeFromParent(); this.scene?.add(this.skin.weapon) }
    if (this.scene) { this.scene.removeFromParent(); disposeScene(this.scene) }
    this.scene = null; this.skin = null
  }
}
function disposeScene(scene: Object3D): void {
  const geometries = new Set<Mesh['geometry']>(), materials = new Set<import('three').Material>(), textures = new Set<import('three').Texture>()
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return
    geometries.add(o.geometry)
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) texture.dispose()
}
