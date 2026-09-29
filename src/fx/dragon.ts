import { BoxGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { easeOutCubic, smoothstep } from '../core/math.ts'
import { ModelSlot, type ModelAsset } from '../assets/model.ts'
import type { BufferGeometry } from 'three'

export interface DragonVisualOptions {
  head?: ModelAsset
  /** Geometry in a unit box, instanced along the existing dragon path. */
  createSegment?: () => BufferGeometry
}

const SEGMENTS = 44
const SPACING = 0.62
export const DRAGON_DURATION = 3.6
const MAX_PATH = 1200

const FORWARD = new Vector3(0, 0, 1)
const UP = new Vector3(0, 1, 0)
const matrix = new Matrix4()
const quat = new Quaternion()
const scale = new Vector3()
const segPos = new Vector3()
const nextPos = new Vector3()
const dir = new Vector3()
const up = new Vector3()
const tmp = new Vector3()
const apex = new Vector3()
const impact = new Vector3()

// 線性 HDR 顏色：交給 bloom 發光
const BODY_HEAD = new Color(0.08, 0.65, 1.3)
const BODY_TAIL = new Color(0.03, 0.25, 0.72)
const GOLD = new Color(1.8, 1.05, 0.2)
const BELLY = new Color(0.7, 0.65, 0.4)

function basic(color: Color): MeshBasicMaterial {
  return new MeshBasicMaterial({ color })
}

/** 無雙召喚的蒼龍：繞趙雲盤旋、升空後俯衝撞地。身體各節沿龍頭走過的路徑依弧長跟隨。 */
export class Dragon {
  readonly group = new Group()
  readonly ready: Promise<void>
  readonly headSlot: ModelSlot
  readonly headPos = new Vector3()
  private readonly head = new Group()
  private readonly jaw = new Group()
  private readonly whiskers: Group[] = []
  private readonly body: InstancedMesh
  private readonly fins: InstancedMesh
  private readonly belly: InstancedMesh
  private readonly path = new Float32Array(MAX_PATH * 4) // x, y, z, 累計弧長
  private pathCount = 0
  private t = 0
  private running = false
  private startFacing = 0
  private readonly center = new Vector3()

  constructor(options: DragonVisualOptions = {}) {
    const box = new BoxGeometry(1, 1, 1)
    const segment = options.createSegment?.() ?? box
    const make = (count: number) => {
      const mesh = new InstancedMesh(segment, basic(new Color(1, 1, 1)), count)
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.frustumCulled = false
      this.group.add(mesh)
      return mesh
    }
    this.body = make(SEGMENTS)
    this.fins = make(SEGMENTS)
    this.belly = make(SEGMENTS)
    const c = new Color()
    for (let i = 0; i < SEGMENTS; i++) {
      const k = i / (SEGMENTS - 1)
      this.body.setColorAt(i, c.copy(BODY_HEAD).lerp(BODY_TAIL, k))
      this.fins.setColorAt(i, c.copy(GOLD).multiplyScalar(1 - k * 0.5))
      this.belly.setColorAt(i, c.copy(BELLY).multiplyScalar(1 - k * 0.6))
    }

    const skin = basic(new Color(0.09, 0.75, 1.15))
    const light = basic(new Color(0.16, 1.2, 1.7))
    const gold = basic(GOLD)
    const eye = basic(new Color(12, 11, 7))
    const white = basic(new Color(3.5, 3.5, 3.2))
    const add = (parent: Group, material: MeshBasicMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0) => {
      const m = new Mesh(box, material)
      m.position.set(x, y, z)
      m.scale.set(sx, sy, sz)
      m.rotation.set(rx, ry, 0)
      parent.add(m)
      return m
    }
    add(this.head, skin, 0, 0, 0, 1.1, 0.8, 1.2)
    add(this.head, light, 0, -0.05, 0.9, 0.8, 0.5, 0.9)
    add(this.head, light, 0, 0.05, 1.35, 0.5, 0.3, 0.2)
    for (const s of [-1, 1]) {
      add(this.head, eye, s * 0.36, 0.2, 0.45, 0.18, 0.14, 0.14)
      add(this.head, gold, s * 0.36, 0.33, 0.4, 0.3, 0.08, 0.3)
      add(this.head, gold, s * 0.3, 0.6, -0.35, 0.12, 0.12, 1.0, -0.7, s * 0.25)
      add(this.head, gold, s * 0.42, 0.95, -0.55, 0.1, 0.1, 0.5, -1.2, s * 0.5)
      for (let k = 0; k < 3; k++) add(this.head, gold, s * 0.3, 0.25 - k * 0.2, -0.6 - k * 0.1, 0.35, 0.12, 0.35, 0.5, s * 0.6)
      const whisker = new Group()
      whisker.position.set(s * 0.32, -0.08, 1.2)
      add(whisker, gold, 0, 0, 0.7, 0.05, 0.05, 1.4)
      this.whiskers.push(whisker)
      this.head.add(whisker)
    }
    this.jaw.position.set(0, -0.3, 0.3)
    add(this.jaw, skin, 0, -0.12, 0.55, 0.7, 0.2, 1.0)
    for (const s of [-1, 1]) add(this.jaw, white, s * 0.25, 0.02, 0.9, 0.08, 0.14, 0.08)
    this.head.add(this.jaw)
    const fallback = new Group()
    fallback.add(...[...this.head.children])
    this.headSlot = new ModelSlot(fallback, options.head)
    this.head.add(this.headSlot.group)
    this.ready = this.headSlot.ready
    this.head.scale.setScalar(1.35)
    this.group.add(this.head)
    this.group.visible = false
  }

  get active(): boolean {
    return this.running
  }

  get elapsed(): number {
    return this.t
  }

  /** 盤旋階段龍頭會撞開附近的敵兵。 */
  get striking(): boolean {
    return this.running && this.t > 0.35 && this.t < 2.55
  }

  start(center: Vector3, facing: number): void {
    this.running = true
    this.t = 0
    this.startFacing = facing
    this.center.copy(center)
    this.pathCount = 0
    this.group.visible = true
  }

  stop(): void {
    this.running = false
    this.group.visible = false
  }

  update(dt: number, center: Vector3, facing: number): void {
    if (!this.running) return
    this.t += dt
    if (this.t >= DRAGON_DURATION) {
      this.stop()
      return
    }
    this.center.copy(center)
    this.headAt(this.t, facing, this.headPos)
    this.record(this.headPos)

    const total = this.path[(this.pathCount - 1) * 4 + 3]
    const appear = smoothstep(0, 0.25, this.t) * (1 - smoothstep(3.2, DRAGON_DURATION, this.t))
    for (let i = 0; i < SEGMENTS; i++) {
      const at = total - i * SPACING
      if (at < 0 || appear <= 0.001) {
        matrix.makeScale(0, 0, 0)
        this.body.setMatrixAt(i, matrix)
        this.fins.setMatrixAt(i, matrix)
        this.belly.setMatrixAt(i, matrix)
        continue
      }
      this.sample(at, segPos)
      this.sample(Math.min(total, at + 0.3), nextPos)
      dir.subVectors(nextPos, segPos)
      if (dir.lengthSq() < 1e-8) dir.copy(FORWARD)
      dir.normalize()
      quat.setFromUnitVectors(FORWARD, dir)
      up.copy(UP).applyQuaternion(quat)
      const taper = (0.25 + 0.75 * Math.pow(1 - i / SEGMENTS, 0.7)) * appear
      const w = 1.25 * taper
      const pulse = 1 + Math.sin(this.t * 14 - i * 0.5) * 0.06
      this.body.setMatrixAt(i, matrix.compose(segPos, quat, scale.set(w * pulse, w * 0.85 * pulse, SPACING * 1.3)))
      tmp.copy(segPos).addScaledVector(up, w * 0.55)
      this.fins.setMatrixAt(i, matrix.compose(tmp, quat, scale.set(0.1 * taper, (i % 2 === 0 ? 0.7 : 0.45) * taper, 0.45 * taper)))
      tmp.copy(segPos).addScaledVector(up, -w * 0.42)
      this.belly.setMatrixAt(i, matrix.compose(tmp, quat, scale.set(w * 0.7, 0.14 * taper, SPACING * 1.1)))
    }
    for (const m of [this.body, this.fins, this.belly]) m.instanceMatrix.needsUpdate = true

    // 龍頭朝前進方向；俯衝時張大嘴
    this.head.position.copy(this.headPos)
    this.sample(Math.max(0, total - 0.6), tmp)
    dir.subVectors(this.headPos, tmp)
    if (dir.lengthSq() > 1e-6) this.head.lookAt(tmp.copy(this.headPos).add(dir))
    this.head.scale.setScalar(1.35 * Math.max(0.001, appear))
    const diving = this.t > 2.9 && this.t < 3.15
    this.jaw.rotation.x = diving ? 0.9 : 0.35 + 0.25 * Math.sin(this.t * 12)
    this.whiskers.forEach((w, i) => {
      w.rotation.y = (i === 0 ? 1 : -1) * (0.5 + 0.2 * Math.sin(this.t * 8 + i))
      w.rotation.x = 0.2 * Math.sin(this.t * 6 + i)
    })
  }

  /** 龍身上的隨機一點（給金色光點特效用）。 */
  randomPoint(rng: () => number, out: Vector3): Vector3 {
    if (this.pathCount === 0) return out.copy(this.headPos)
    const total = this.path[(this.pathCount - 1) * 4 + 3]
    return this.sample(Math.max(0, total - rng() * SEGMENTS * SPACING), out)
  }

  private headAt(t: number, facing: number, out: Vector3): Vector3 {
    const c = this.center
    const spiral = (tt: number, o: Vector3) => {
      const ang = this.startFacing + Math.PI + tt * 4.6
      const grow = easeOutCubic(Math.min(1, tt / 0.5))
      const r = 1.2 + 4.6 * grow + Math.sin(tt * 3) * 0.6 * grow
      const y = 0.5 + 3.2 * grow + Math.sin(tt * 5.2) * 1.1 * grow
      return o.set(c.x + Math.sin(ang) * r, y, c.z + Math.cos(ang) * r)
    }
    if (t < 2.55) return spiral(t, out)
    const fx = Math.sin(facing)
    const fz = Math.cos(facing)
    apex.set(c.x + fx * 3, 15, c.z + fz * 3)
    impact.set(c.x + fx * 6, 0, c.z + fz * 6)
    if (t < 2.95) return spiral(2.55, out).lerp(apex, smoothstep(0, 1, (t - 2.55) / 0.4))
    if (t < 3.1) {
      const u = (t - 2.95) / 0.15
      return out.copy(apex).lerp(impact, u * u)
    }
    const u = (t - 3.1) / 0.5
    return out.set(impact.x + fx * 3 * u, -5 * u, impact.z + fz * 3 * u)
  }

  private record(p: Vector3): void {
    if (this.pathCount === MAX_PATH) {
      this.path.copyWithin(0, 4)
      this.pathCount--
    }
    const i = this.pathCount
    let len = 0
    if (i > 0) {
      const j = (i - 1) * 4
      len = this.path[j + 3] + Math.hypot(p.x - this.path[j], p.y - this.path[j + 1], p.z - this.path[j + 2])
    }
    this.path.set([p.x, p.y, p.z, len], i * 4)
    this.pathCount++
  }

  /** 依累計弧長在路徑上內插位置。 */
  private sample(at: number, out: Vector3): Vector3 {
    const n = this.pathCount
    if (n === 1 || at <= this.path[3]) return out.set(this.path[0], this.path[1], this.path[2])
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (this.path[mid * 4 + 3] < at) lo = mid
      else hi = mid
    }
    const a = lo * 4
    const b = hi * 4
    const span = this.path[b + 3] - this.path[a + 3]
    const k = span > 1e-6 ? (at - this.path[a + 3]) / span : 0
    return out.set(
      this.path[a] + (this.path[b] - this.path[a]) * k,
      this.path[a + 1] + (this.path[b + 1] - this.path[a + 1]) * k,
      this.path[a + 2] + (this.path[b + 2] - this.path[a + 2]) * k,
    )
  }
}
