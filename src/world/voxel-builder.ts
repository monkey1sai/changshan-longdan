import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

interface Face {
  n: [number, number, number]
  corners: [number, number, number][]
  shade: number
}

// 每面四個角依逆時針（從外側看）排列；shade 是烘焙的體素明暗
const FACES: Face[] = [
  { n: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], shade: 0.9 },
  { n: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], shade: 0.9 },
  { n: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], shade: 1.06 },
  { n: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], shade: 0.72 },
  { n: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], shade: 1 },
  { n: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], shade: 0.95 },
]

/** 把大量方塊合併成一個帶頂點色的幾何，一次 draw call 畫完。 */
export class VoxelBuilder {
  private readonly positions: number[] = []
  private readonly normals: number[] = []
  private readonly colors: number[] = []
  private readonly indices: number[] = []

  get vertexCount(): number {
    return this.positions.length / 3
  }

  /** 加入中心 (cx, cy, cz)、尺寸 (sx, sy, sz) 的方塊，可繞 Y 軸旋轉 rotY。 */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: Color, rotY = 0): this {
    const hx = sx / 2
    const hy = sy / 2
    const hz = sz / 2
    const cos = Math.cos(rotY)
    const sin = Math.sin(rotY)
    for (const face of FACES) {
      const base = this.positions.length / 3
      const nx = face.n[0] * cos + face.n[2] * sin
      const nz = -face.n[0] * sin + face.n[2] * cos
      for (const [x, y, z] of face.corners) {
        const lx = x * hx
        const lz = z * hz
        this.positions.push(cx + lx * cos + lz * sin, cy + y * hy, cz - lx * sin + lz * cos)
        this.normals.push(nx, face.n[1], nz)
        this.colors.push(color.r * face.shade, color.g * face.shade, color.b * face.shade)
      }
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    return this
  }

  /** 以最小角與最大角描述的方塊。 */
  span(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Color): this {
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color)
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    geometry.setIndex(this.indices)
    geometry.computeBoundingSphere()
    geometry.computeBoundingBox()
    return geometry
  }
}

/** 亮度隨機擾動，讓同色方塊看起來有手工感。 */
export function jitter(color: Color, rng: () => number, amount = 0.08): Color {
  return color.clone().multiplyScalar(1 + (rng() - 0.5) * 2 * amount)
}
