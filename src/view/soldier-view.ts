import {
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three'
import { smoothstep } from '../core/math.ts'
import { Kind, State, type EnemyStore } from '../entities/enemies.ts'
import { withInstanceFlash } from '../render/materials.ts'
import { VoxelBuilder } from '../world/voxel-builder.ts'
import type { LevelId } from '../world/levels.ts'
import { ENEMY_PARTS, enemyMeshes, type EnemyPose, type EnemyVisualOptions } from '../assets/enemy.ts'
import { disposeObject, loadModel } from '../assets/model.ts'

const hex = (h: string) => new Color(h)
export const SOLDIER_COLORS = {
  armor: hex('#2f5dbd'),
  armorLight: hex('#4f7fd8'),
  armorDark: hex('#213f86'),
  cloth: hex('#2a2c38'),
  boot: hex('#1b1612'),
  skin: hex('#c8926c'),
  helmet: hex('#223153'),
  trim: hex('#b69449'),
  belt: hex('#8a6a32'),
  steel: hex('#c9d1d8'),
  wood: hex('#6b4a2b'),
  red: hex('#b8322a'),
  shield: hex('#27447f'),
  rim: hex('#9aa3ab'),
  dark: hex('#141210'),
}
const S = SOLDIER_COLORS

function legGeometry(): BufferGeometry {
  return new VoxelBuilder()
    .box(0, -0.2, 0, 0.22, 0.4, 0.24, S.cloth)
    .box(0, -0.58, 0, 0.2, 0.38, 0.22, S.cloth)
    .box(0, -0.52, 0.1, 0.21, 0.24, 0.05, S.armorDark)
    .box(0, -0.8, 0.04, 0.23, 0.12, 0.3, S.boot)
    .build()
}

function torsoGeometry(): BufferGeometry {
  return new VoxelBuilder()
    .box(0, 0.08, 0, 0.52, 0.26, 0.34, S.armorDark)
    .box(0, 0.36, 0, 0.5, 0.42, 0.32, S.armor)
    .box(0, 0.4, 0.165, 0.36, 0.26, 0.02, S.armorLight)
    .box(0, 0.2, 0, 0.54, 0.07, 0.36, S.belt)
    .box(0, 0.62, 0, 0.3, 0.08, 0.26, S.cloth)
    .box(-0.3, 0.55, 0, 0.18, 0.12, 0.3, S.armorDark)
    .box(0.3, 0.55, 0, 0.18, 0.12, 0.3, S.armorDark)
    .build()
}

function headGeometry(): BufferGeometry {
  return new VoxelBuilder()
    .box(0, 0.05, 0, 0.12, 0.1, 0.12, S.skin)
    .box(0, 0.2, 0, 0.26, 0.26, 0.26, S.skin)
    .box(-0.06, 0.21, 0.131, 0.05, 0.035, 0.01, S.dark)
    .box(0.06, 0.21, 0.131, 0.05, 0.035, 0.01, S.dark)
    .box(0, 0.33, 0, 0.32, 0.12, 0.32, S.helmet)
    .box(0, 0.285, 0.15, 0.33, 0.05, 0.04, S.trim)
    .box(0, 0.42, 0, 0.06, 0.08, 0.06, S.trim)
    .box(0, 0.22, -0.15, 0.3, 0.2, 0.04, S.helmet)
    .build()
}

function armGeometry(): BufferGeometry {
  return new VoxelBuilder()
    .box(0, -0.15, 0, 0.15, 0.3, 0.17, S.armor)
    .box(0, -0.43, 0, 0.14, 0.26, 0.15, S.cloth)
    .box(0, -0.44, 0, 0.155, 0.12, 0.165, S.helmet)
    .box(0, -0.6, 0, 0.11, 0.1, 0.11, S.skin)
    .build()
}

function spearGeometry(): BufferGeometry {
  return new VoxelBuilder()
    .box(0, 0.6, 0, 0.05, 2.6, 0.05, S.wood)
    .box(0, 1.9, 0, 0.12, 0.14, 0.12, S.red)
    .box(0, 2.18, 0, 0.07, 0.32, 0.025, S.steel)
    .box(0, 2.38, 0, 0.035, 0.1, 0.02, S.steel)
    .build()
}

function swordGeometry(): BufferGeometry {
  return new VoxelBuilder()
    .box(0, -0.08, 0, 0.05, 0.18, 0.05, S.wood)
    .box(0, 0.03, 0, 0.18, 0.04, 0.06, S.trim)
    .box(0, 0.45, 0, 0.07, 0.8, 0.02, S.steel)
    .box(0.015, 0.78, 0, 0.09, 0.16, 0.02, S.steel)
    .build()
}

function shieldGeometry(): BufferGeometry {
  return new VoxelBuilder()
    .box(0, 0, 0, 0.5, 0.62, 0.05, S.shield)
    .box(0, 0.3, 0.01, 0.52, 0.05, 0.06, S.rim)
    .box(0, -0.3, 0.01, 0.52, 0.05, 0.06, S.rim)
    .box(0, 0, 0.04, 0.14, 0.14, 0.05, S.trim)
    .box(0, 0.14, 0.03, 0.34, 0.06, 0.02, S.red)
    .build()
}

function plumeGeometry(): BufferGeometry {
  return new VoxelBuilder()
    // 隊長的三叉長翎：只給 Captain 啟用，從人群中讀得出指揮單位。
    .box(0, 0.16, -0.02, 0.08, 0.34, 0.22, S.red)
    .box(0, 0.34, -0.14, 0.065, 0.22, 0.16, S.red)
    .box(-0.11, 0.23, -0.08, 0.05, 0.2, 0.12, S.red)
    .box(0.11, 0.23, -0.08, 0.05, 0.2, 0.12, S.red)
    .box(0, 0.02, 0.02, 0.13, 0.05, 0.13, S.trim)
    .build()
}

const ZERO = new Matrix4().makeScale(0, 0, 0)
const UP = new Vector3(0, 1, 0)
const euler = new Euler()
const quat = new Quaternion()
const pos = new Vector3()
const one = new Vector3(1, 1, 1)
const tmp = new Matrix4()
const root = new Matrix4()
const pivot = new Matrix4()
const body = new Matrix4()
const torso = new Matrix4()
const head = new Matrix4()
const armR = new Matrix4()
const armL = new Matrix4()
const part = new Matrix4()
const scaleVec = new Vector3()

/** parent · T(tx,ty,tz) · R(rx,ry,rz) */
function local(parent: Matrix4, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, out: Matrix4): Matrix4 {
  euler.set(rx, ry, rz)
  quat.setFromEuler(euler)
  pos.set(tx, ty, tz)
  tmp.compose(pos, quat, one)
  return out.multiplyMatrices(parent, tmp)
}

interface Part {
  mesh: InstancedMesh
  flash: Float32Array
  flashAttr: InstancedBufferAttribute
}

/** 以實例化網格繪製所有魏兵，依 AI 狀態計算每名士兵的姿勢。 */
export class SoldierView {
  readonly group = new Group()
  readonly ready: Promise<void>
  assetStatus: 'procedural' | 'loading' | 'ready' | 'fallback' = 'procedural'
  assetError: string | null = null
  private readonly options: EnemyVisualOptions
  private readonly pose: EnemyPose = { legR: 0, legL: 0, armRx: 0, armLx: 0, abduct: 0, lean: 0, nod: 0, tumble: 0, lift: 0, weapon: 0 }
  private readonly legs: Part
  private readonly arms: Part
  private readonly torso: Part
  private readonly head: Part
  private readonly spear: Part
  private readonly sword: Part
  private readonly shield: Part
  private readonly plume: Part

  constructor(capacity: number, options: EnemyVisualOptions = {}) {
    this.options = options
    const material = withInstanceFlash(new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.12 }))
    this.legs = this.part(legGeometry(), material, capacity * 2)
    this.arms = this.part(armGeometry(), material, capacity * 2)
    this.torso = this.part(torsoGeometry(), material, capacity)
    this.head = this.part(headGeometry(), material, capacity)
    this.spear = this.part(spearGeometry(), material, capacity)
    this.sword = this.part(swordGeometry(), material, capacity)
    this.shield = this.part(shieldGeometry(), material, capacity)
    this.plume = this.part(plumeGeometry(), material, capacity)
    this.ready = options.model ? this.loadParts(options.model) : Promise.resolve()
  }

  private async loadParts(asset: NonNullable<EnemyVisualOptions['model']>): Promise<void> {
    this.assetStatus = 'loading'
    let scene: Group | undefined
    try {
      scene = await loadModel(asset)
      const meshes = enemyMeshes(scene, asset)
      const oldMaterials = new Set<MeshStandardMaterial>()
      for (const role of ENEMY_PARTS) {
        const target = this[role]
        const source = meshes[role]
        const geometry = source.geometry.clone()
        geometry.setAttribute('instanceFlash', target.flashAttr)
        target.mesh.geometry.dispose()
        oldMaterials.add(target.mesh.material as MeshStandardMaterial)
        target.mesh.geometry = geometry
        target.mesh.material = withInstanceFlash((source.material as MeshStandardMaterial).clone())
      }
      for (const material of oldMaterials) material.dispose()
      // New materials retain source textures; release only original mesh resources.
      const geometries = new Set(Object.values(meshes).map((mesh) => mesh.geometry))
      const materials = new Set(Object.values(meshes).map((mesh) => mesh.material as MeshStandardMaterial))
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      this.assetStatus = 'ready'
    } catch (error) {
      if (scene) disposeObject(scene)
      this.assetStatus = 'fallback'
      this.assetError = error instanceof Error ? error.message : String(error)
    }
  }

  /** 每名士兵的色調變化；隊長採用深靛金調，配合長翎形成辨識點。 */
  applyColors(store: EnemyStore, rng: () => number, level: LevelId = 'fortress'): void {
    const c = new Color()
    for (let i = 0; i < store.count; i++) {
      if (store.kind[i] === Kind.Captain) {
        if (level === 'fortress') c.setRGB(0.48, 0.42, 0.68)
        else c.setRGB(4.8, 0.32, 0.68)
      }
      else {
        const v = 0.82 + rng() * 0.26
        if (level === 'fortress') c.setRGB(v, v, v * (0.95 + rng() * 0.1))
        else c.setRGB(v * 3.7, v * 0.42, v * 0.55)
      }
      this.torso.mesh.setColorAt(i, c)
      this.arms.mesh.setColorAt(i * 2, c)
      this.arms.mesh.setColorAt(i * 2 + 1, c)
      this.legs.mesh.setColorAt(i * 2, c)
      this.legs.mesh.setColorAt(i * 2 + 1, c)
    }
    for (const p of [this.torso, this.arms, this.legs]) {
      if (p.mesh.instanceColor !== null) p.mesh.instanceColor.needsUpdate = true
    }
  }

  update(store: EnemyStore, time: number): void {
    for (const p of this.allParts()) p.mesh.count = store.count * (p === this.legs || p === this.arms ? 2 : 1)
    for (let i = 0; i < store.count; i++) {
      if (store.alive[i] === 0) {
        this.hide(i)
        continue
      }
      const state = store.state[i]
      const t = store.stateTime[i]
      const kind = store.kind[i]
      const walk = store.moveBlend[i]
      const swing = Math.sin(store.phase[i]) * 0.7 * walk
      let legR = swing
      let legL = -swing
      let armRx = -swing * 0.6
      let armLx = swing * 0.6
      let abduct = 0.08
      let lean = 0.08 * walk
      let nod = 0
      let tumble = 0
      let lift = Math.abs(Math.cos(store.phase[i])) * 0.05 * walk
      let weapon = 0 // 0 持械、1 舉起、2 出手
      const breathe = Math.sin(time * 2 + i * 1.7) * 0.012

      switch (state) {
        case State.Windup: {
          const k = smoothstep(0, 0.3, t)
          armRx = -2.4 * k
          lean = -0.12 * k
          weapon = 1
          break
        }
        case State.Strike:
          armRx = -0.9
          lean = 0.3
          weapon = 2
          break
        case State.Recover: {
          const k = 1 - smoothstep(0, 0.5, t)
          armRx = -0.9 * k
          lean = 0.3 * k
          weapon = k > 0.5 ? 2 : 0
          break
        }
        case State.Flinch: {
          const k = Math.sin(Math.min(1, t / 0.42) * Math.PI)
          lean = -0.45 * k
          nod = -0.4 * k
          abduct = 0.1 + 0.6 * k
          armRx = -0.3 * k
          armLx = -0.3 * k
          break
        }
        case State.Knockback:
          lean = -0.4
          abduct = 0.5
          legR = 0.3
          legL = -0.2
          break
        case State.Air:
          tumble = store.spin[i]
          abduct = 0.9
          legR = 0.5
          legL = -0.4
          armRx = -1.2
          armLx = -1.2
          break
        case State.Down:
          tumble = -Math.PI / 2
          lift = -0.74
          abduct = 0.3
          break
        case State.Getup: {
          const k = smoothstep(0, 0.5, t)
          tumble = (-Math.PI / 2) * (1 - k)
          lift = -0.74 * (1 - k)
          legR = 0.9 * (1 - k)
          legL = 0.9 * (1 - k)
          break
        }
      }

      if (this.options.animate) {
        const p = this.pose
        p.legR = legR; p.legL = legL; p.armRx = armRx; p.armLx = armLx; p.abduct = abduct
        p.lean = lean; p.nod = nod; p.tumble = tumble; p.lift = lift; p.weapon = weapon
        this.options.animate(store, i, time, p)
        ;({ legR, legL, armRx, armLx, abduct, lean, nod, tumble, lift, weapon } = p)
      }
      const s = store.scale[i]
      scaleVec.set(s, s, s)
      quat.setFromAxisAngle(UP, store.yaw[i])
      pos.set(store.x[i], store.y[i] + lift, store.z[i])
      root.compose(pos, quat, scaleVec)
      local(root, 0, 0.9, 0, tumble, 0, 0, pivot)
      local(pivot, 0, -0.9, 0, 0, 0, 0, body)

      local(body, 0, 0.86 + breathe, 0, lean, 0, 0, torso)
      local(torso, 0, 0.66, 0, nod, 0, 0, head)
      local(torso, -0.33, 0.56, 0, armRx, 0, -abduct, armR)
      local(torso, 0.33, 0.56, 0, armLx, 0, abduct, armL)
      this.torso.mesh.setMatrixAt(i, torso)
      this.head.mesh.setMatrixAt(i, head)
      this.arms.mesh.setMatrixAt(i * 2, armR)
      this.arms.mesh.setMatrixAt(i * 2 + 1, armL)
      this.legs.mesh.setMatrixAt(i * 2, local(body, -0.12, 0.86, 0, legR, 0, -0.03, part))
      this.legs.mesh.setMatrixAt(i * 2 + 1, local(body, 0.12, 0.86, 0, legL, 0, 0.03, part))

      const usesSword = kind === Kind.Sword
      if (usesSword) {
        this.spear.mesh.setMatrixAt(i, ZERO)
        if (weapon === 1) local(torso, -0.32, 0.78, -0.05, -0.5, 0, 0, part)
        else if (weapon === 2) local(torso, -0.22, 0.28, 0.5, 2.1, 0, 0, part)
        else local(torso, -0.4, 0.05, 0.22, 1.75, 0, 0, part)
        this.sword.mesh.setMatrixAt(i, part)
        this.shield.mesh.setMatrixAt(i, local(armL, 0.08, -0.42, 0.12, 0, 0, 0, part))
      } else {
        this.sword.mesh.setMatrixAt(i, ZERO)
        this.shield.mesh.setMatrixAt(i, ZERO)
        if (weapon === 1) local(torso, -0.3, 0.45, 0.1, 1.0, 0, 0, part)
        else if (weapon === 2) local(torso, -0.22, 0.32, 0.45, 1.62, 0, 0, part)
        else local(torso, -0.4, 0.1 + breathe, 0.14, 0.12 + swing * 0.1, 0, 0, part)
        this.spear.mesh.setMatrixAt(i, part)
      }
      this.plume.mesh.setMatrixAt(i, kind === Kind.Captain ? local(head, 0, 0.4, 0, 0, 0, 0, part) : ZERO)

      const flash = store.flash[i]
      this.torso.flash[i] = flash
      this.head.flash[i] = flash
      this.spear.flash[i] = flash
      this.sword.flash[i] = flash
      this.shield.flash[i] = flash
      this.plume.flash[i] = flash
      this.arms.flash[i * 2] = flash
      this.arms.flash[i * 2 + 1] = flash
      this.legs.flash[i * 2] = flash
      this.legs.flash[i * 2 + 1] = flash
    }
    for (const p of this.allParts()) {
      p.mesh.instanceMatrix.needsUpdate = true
      p.flashAttr.needsUpdate = true
    }
  }

  private hide(i: number): void {
    for (const p of [this.torso, this.head, this.spear, this.sword, this.shield, this.plume]) p.mesh.setMatrixAt(i, ZERO)
    for (const p of [this.arms, this.legs]) {
      p.mesh.setMatrixAt(i * 2, ZERO)
      p.mesh.setMatrixAt(i * 2 + 1, ZERO)
    }
  }

  private allParts(): Part[] {
    return [this.legs, this.arms, this.torso, this.head, this.spear, this.sword, this.shield, this.plume]
  }

  private part(geometry: BufferGeometry, material: MeshStandardMaterial, count: number): Part {
    const flash = new Float32Array(count)
    const flashAttr = new InstancedBufferAttribute(flash, 1)
    flashAttr.setUsage(DynamicDrawUsage)
    geometry.setAttribute('instanceFlash', flashAttr)
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    this.group.add(mesh)
    return { mesh, flash, flashAttr }
  }
}
