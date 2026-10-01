import { BufferGeometry, CylinderGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector2, type Vector3 } from 'three'

/** Same shaft origin and blade tip as the existing combat/FX rig. */
export function refinedSpear(blade: MeshStandardMaterial): Group {
  const group = new Group()
  const steel = new MeshStandardMaterial({ color: '#c6d4dd', metalness: 0.8, roughness: 0.29 })
  const gold = new MeshStandardMaterial({ color: '#b79445', metalness: 0.72, roughness: 0.32 })
  const red = new MeshStandardMaterial({ color: '#a52625', roughness: 0.9 })
  const cylinder = (radius: number, length: number, z: number, material: MeshStandardMaterial) => {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 16), material)
    mesh.rotation.x = Math.PI / 2
    mesh.position.z = z
    mesh.castShadow = true
    group.add(mesh)
  }
  cylinder(.022, 3.1, .55, steel)
  for (const z of [-.94, -.5, .5, 1.4, 2.06]) cylinder(.035, .07, z, gold)
  const head = new Mesh(new LatheGeometry([
    new Vector2(.028, 0), new Vector2(.083, .14), new Vector2(.065, .29), new Vector2(0, .60),
  ], 12), blade)
  head.scale.z = .26
  head.rotation.x = Math.PI / 2
  head.position.z = 2.1
  head.castShadow = true
  group.add(head)
  for (let i = 0; i < 7; i++) {
    const tassel = new Mesh(new SphereGeometry(1, 8, 6), red)
    tassel.scale.set(.018, .13 + i % 3 * .02, .018)
    tassel.position.set((i - 3) * .018, -.1, 1.99 - Math.abs(i - 3) * .01)
    tassel.rotation.z = (i - 3) * .09
    group.add(tassel)
  }
  return group
}

/** One continuous cloth surface follows the original Verlet chain. */
export class RefinedCape {
  readonly mesh: Mesh
  private readonly positions = new Float32Array(25 * 13 * 3)
  private readonly geometry = new BufferGeometry()
  constructor() {
    const indices: number[] = []
    const colors: number[] = []
    const cols = 12
    const rows = 24
    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x <= cols; x++) {
        const border = x === 0 || x === cols || y >= rows - 1
        colors.push(...(border ? [.04, .22, .12] : [.78, .82, .74]))
        if (x < cols && y < rows) {
          const a = y * (cols + 1) + x
          indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2)
        }
      }
    }
    this.geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage))
    this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    this.geometry.setIndex(indices)
    this.mesh = new Mesh(this.geometry, new MeshStandardMaterial({ vertexColors: true, roughness: .9, side: DoubleSide }))
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
  }

  update(points: readonly Vector3[], right: Vector3, forward: Vector3): void {
    const position = this.geometry.attributes.position
    for (let row = 0; row <= 24; row++) {
      const t = row / 24 * (points.length - 1)
      const i = Math.min(points.length - 2, Math.floor(t))
      const f = t - i
      const a = points[i]
      const b = points[i + 1]
      for (let col = 0; col <= 12; col++) {
        const u = col / 12
        const width = (u - .5) * (.50 + row / 24 * .14)
        const fold = .014 * Math.cos(u * Math.PI * 6)
        position.setXYZ(row * 13 + col,
          a.x + (b.x - a.x) * f + right.x * width + forward.x * fold,
          a.y + (b.y - a.y) * f + right.y * width + forward.y * fold,
          a.z + (b.z - a.z) * f + right.z * width + forward.z * fold)
      }
    }
    position.needsUpdate = true
    this.geometry.computeVertexNormals()
  }
}
