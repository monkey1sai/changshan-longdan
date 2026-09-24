import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { Kind, type KillInfo } from '../entities/enemies.ts'
import { PLAY_LIMIT } from '../world/layout.ts'
import { SOLDIER_COLORS as S } from '../view/soldier-view.ts'

// 依身體高度（0 腳底 → 1 頭頂）挑選碎片顏色
const BANDS: [number, Color[]][] = [
  [0.0, [S.boot, S.cloth]],
  [0.24, [S.cloth, S.armorDark]],
  [0.46, [S.armorDark, S.belt, S.armor]],
  [0.58, [S.armor, S.armorLight, S.armor]],
  [0.83, [S.skin]],
  [0.92, [S.helmet, S.trim]],
]

const matrix = new Matrix4()
const position = new Vector3()
const quaternion = new Quaternion()
const scale = new Vector3()
const euler = new Euler()

/** 士兵被擊破時炸成的體素碎片：受重力、會彈跳並投射陰影，最後縮小消失。 */
export class Fragments {
  readonly mesh: InstancedMesh
  private readonly capacity: number
  private count = 0
  private cursor = 0
  private readonly p: Float32Array // 位置 xyz
  private readonly v: Float32Array // 速度 xyz
  private readonly r: Float32Array // 旋轉 xyz
  private readonly w: Float32Array // 角速度 xyz
  private readonly size: Float32Array
  private readonly life: Float32Array
  private readonly colors: Float32Array

  constructor(capacity = 5000) {
    this.capacity = capacity
    this.p = new Float32Array(capacity * 3)
    this.v = new Float32Array(capacity * 3)
    this.r = new Float32Array(capacity * 3)
    this.w = new Float32Array(capacity * 3)
    this.size = new Float32Array(capacity)
    this.life = new Float32Array(capacity)
    this.colors = new Float32Array(capacity * 3)
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }), capacity)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.instanceColor = new InstancedBufferAttribute(this.colors, 3)
    this.mesh.instanceColor.setUsage(DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.frustumCulled = false
  }

  get active(): number {
    return this.count
  }

  clear(): void {
    this.count = 0
    this.mesh.count = 0
  }

  spawnSoldier(kill: KillInfo, rng: () => number): void {
    const captain = kill.kind === Kind.Captain
    const body = captain ? 1.22 : 1
    const n = captain ? 28 : 18
    const c = Math.cos(kill.yaw)
    const s = Math.sin(kill.yaw)
    for (let k = 0; k < n; k++) {
      const h = rng()
      let palette = BANDS[0][1]
      for (const [from, colors] of BANDS) if (h >= from) palette = colors
      const weapon = k < 2
      const color = weapon ? (k === 0 ? S.steel : S.wood) : palette[Math.floor(rng() * palette.length)]
      const lx = (rng() - 0.5) * 0.46 * body
      const lz = (rng() - 0.5) * 0.3 * body
      this.spawn(
        kill.x + lx * c + lz * s,
        kill.y + (weapon ? 1.1 : h * 1.8 * body),
        kill.z - lx * s + lz * c,
        kill.vx + (rng() - 0.5) * 5,
        kill.vy + 1.5 + rng() * 4 + h * 2,
        kill.vz + (rng() - 0.5) * 5,
        (0.12 + rng() * 0.11) * body,
        1.8 + rng() * 1.4,
        color,
        rng,
      )
    }
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, color: Color, rng: () => number): void {
    let i: number
    if (this.count < this.capacity) i = this.count++
    else i = this.cursor = (this.cursor + 1) % this.capacity
    const i3 = i * 3
    this.p[i3] = x
    this.p[i3 + 1] = y
    this.p[i3 + 2] = z
    this.v[i3] = vx
    this.v[i3 + 1] = vy
    this.v[i3 + 2] = vz
    this.r[i3] = rng() * 6
    this.r[i3 + 1] = rng() * 6
    this.r[i3 + 2] = rng() * 6
    this.w[i3] = (rng() - 0.5) * 28
    this.w[i3 + 1] = (rng() - 0.5) * 28
    this.w[i3 + 2] = (rng() - 0.5) * 28
    this.size[i] = size
    this.life[i] = life
    this.colors[i3] = color.r
    this.colors[i3 + 1] = color.g
    this.colors[i3 + 2] = color.b
  }

  update(dt: number): void {
    const limit = PLAY_LIMIT + 0.8
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt
      if (this.life[i] <= 0) {
        this.remove(i)
        i--
        continue
      }
      const i3 = i * 3
      const half = this.size[i] / 2
      const drag = 1 - 0.25 * dt
      this.v[i3] *= drag
      this.v[i3 + 2] *= drag
      this.v[i3 + 1] -= 24 * dt
      for (let a = 0; a < 3; a++) {
        this.p[i3 + a] += this.v[i3 + a] * dt
        this.r[i3 + a] += this.w[i3 + a] * dt
      }
      if (this.p[i3 + 1] < half) {
        this.p[i3 + 1] = half
        if (this.v[i3 + 1] < 0) {
          this.v[i3 + 1] = Math.abs(this.v[i3 + 1]) < 1 ? 0 : -this.v[i3 + 1] * 0.32
          this.v[i3] *= 0.7
          this.v[i3 + 2] *= 0.7
          for (let a = 0; a < 3; a++) this.w[i3 + a] *= 0.65
        }
      }
      for (const a of [0, 2]) {
        if (Math.abs(this.p[i3 + a]) > limit) {
          this.p[i3 + a] = Math.sign(this.p[i3 + a]) * limit
          this.v[i3 + a] *= -0.4
        }
      }
      const shrink = Math.min(1, this.life[i] / 0.35)
      position.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2])
      quaternion.setFromEuler(euler.set(this.r[i3], this.r[i3 + 1], this.r[i3 + 2]))
      scale.setScalar(this.size[i] * shrink)
      this.mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale))
    }
    this.mesh.count = this.count
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor !== null) this.mesh.instanceColor.needsUpdate = true
  }

  /** 以最後一個碎片填補空位，維持陣列緊密。 */
  private remove(i: number): void {
    const last = --this.count
    if (i === last) return
    const i3 = i * 3
    const l3 = last * 3
    for (let a = 0; a < 3; a++) {
      this.p[i3 + a] = this.p[l3 + a]
      this.v[i3 + a] = this.v[l3 + a]
      this.r[i3 + a] = this.r[l3 + a]
      this.w[i3 + a] = this.w[l3 + a]
      this.colors[i3 + a] = this.colors[l3 + a]
    }
    this.size[i] = this.size[last]
    this.life[i] = this.life[last]
  }
}
