import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { createRng } from '../core/math.ts'
import { jitter, VoxelBuilder } from './voxel-builder.ts'
import { MANOR_FLOWERBEDS, MANOR_HOUSES, MANOR_HALL, MANOR_LAMPS, MANOR_PEOPLE } from './levels.ts'

const color = (value: string) => new Color(value)
const P = {
  stone: color('#c1b9bb'), shadow: color('#77778f'), ivory: color('#e0d8cb'),
  roof: color('#514970'), roofEdge: color('#a6a0c2'), wood: color('#59485a'),
  gold: color('#e4c985'), path: color('#9691a4'), lawn: color('#435744'),
  leaf: color('#49615b'), leafLight: color('#81998a'), trunk: color('#625465'),
  blossom: color('#c7a2c9'), blue: color('#91c7e5'), violet: color('#ba91db'),
  light: color('#fff1bd'), deep: color('#34324d'), skin: color('#d7ae99'),
  black: color('#252434'), mossHair: color('#45645a'), copperHair: color('#b98253'),
  olive: color('#667658'),
}

export interface ManorBuild {
  group: Group
  people: Group[]
}

function addMesh(group: Group, voxels: VoxelBuilder, luminous = false): void {
  if (voxels.vertexCount === 0) return
  const material = luminous
    ? new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    : new MeshStandardMaterial({ vertexColors: true, roughness: 0.83, metalness: 0.04 })
  const mesh = new Mesh(voxels.build(), material)
  mesh.castShadow = !luminous
  mesh.receiveShadow = !luminous
  group.add(mesh)
}

function hall(b: VoxelBuilder, glow: VoxelBuilder): void {
  const r = MANOR_HALL
  const cx = (r.minX + r.maxX) / 2
  const cz = (r.minZ + r.maxZ) / 2
  b.box(cx, 7, cz, 46, 14, 19, P.ivory)
  b.box(cx, 1, r.maxZ + 0.25, 48, 2, 0.55, P.shadow)
  for (let y = 0; y < 4; y++) {
    b.box(cx, 14.5 + y * 1.15, cz, 49 - y * 2, 1.15, 22 - y * 2, y % 2 ? P.roof : P.roofEdge)
  }
  b.box(cx, 19.3, cz, 40, 0.6, 1.2, P.gold)
  for (const x of [-19, 19]) {
    b.box(x, 11, -43, 8, 22, 9, P.stone)
    for (let i = 0; i < 5; i++) b.box(x, 22 + i * 1.15, -43, 10 - i * 1.3, 1.15, 11 - i * 1.3, P.roof)
    b.box(x, 28, -43, 1.5, 1.8, 1.5, P.gold)
    glow.box(x, 15, -38.43, 2.2, 3.2, 0.12, P.light)
  }
  // 對稱柱廊、拱門與夜色中的明窗。
  for (const x of [-15, -9, 9, 15]) {
    b.box(x, 5.5, -35.65, 0.85, 11, 0.85, P.stone)
    b.box(x, 10.9, -35.65, 2.7, 0.65, 1.2, P.gold)
    glow.box(x, 6.9, -35.46, 2.4, 3.5, 0.1, P.light)
    b.box(x, 6.9, -35.38, 0.12, 3.5, 0.16, P.wood)
    b.box(x, 6.9, -35.38, 2.4, 0.12, 0.16, P.wood)
  }
  b.box(0, 4.4, -35.62, 6.6, 8.8, 0.5, P.deep)
  b.box(0, 8.9, -35.45, 8, 0.8, 1, P.gold)
  b.box(0, 5.2, -35.3, 0.18, 8.2, 0.18, P.gold)
  glow.box(0, 12, -35.35, 2.3, 2.3, 0.16, P.violet)
  for (const x of [-3.7, 3.7]) b.box(x, 4, -34.9, 0.65, 8, 0.7, P.stone)
}

function villageHouse(b: VoxelBuilder, glow: VoxelBuilder, x: number, z: number, width: number, depth: number): void {
  b.box(x, 4.3, z, width, 8.6, depth, P.ivory)
  b.box(x, 0.6, z, width + 0.5, 1.2, depth + 0.5, P.shadow)
  for (let layer = 0; layer < 5; layer++) {
    b.box(x, 9.1 + layer * 0.9, z, width + 2 - layer * 1.2, 0.9, depth + 2 - layer * 0.8, layer % 2 ? P.roof : P.roofEdge)
  }
  b.box(x, 14, z, 1, 1.3, 1, P.gold)
  const front = z + depth / 2 + 0.08
  glow.box(x - width * 0.27, 5.3, front, 2.1, 2.9, 0.14, P.light)
  glow.box(x + width * 0.27, 5.3, front, 2.1, 2.9, 0.14, P.light)
  b.box(x, 2.5, front, 2.8, 5, 0.18, P.wood)
  for (const dx of [-width * 0.27, width * 0.27]) {
    b.box(x + dx, 5.3, front + 0.1, 0.12, 2.9, 0.12, P.wood)
    b.box(x + dx, 5.3, front + 0.1, 2.1, 0.12, 0.12, P.wood)
  }
}

function grove(b: VoxelBuilder, glow: VoxelBuilder, rng: () => number): void {
  for (const side of [-1, 1]) {
    for (let z = -69; z <= 61; z += 8.5) {
      const x = side * (61 + rng() * 10)
      const zz = z + (rng() - 0.5) * 5
      const h = 7 + rng() * 5
      b.box(x, h / 2, zz, 1.25, h, 1.25, P.trunk)
      b.box(x, h + 1.4, zz, 5 + rng() * 2, 5.5, 5 + rng() * 2, jitter(P.leaf, rng, 0.17))
      b.box(x, h + 4.3, zz, 3.2, 3.3, 3.2, jitter(P.leafLight, rng, 0.17))
    }
  }
  // 柔和的魔法燈取代原關卡的火盆。
  for (const { x, z } of MANOR_LAMPS) {
    b.box(x, 1.8, z, 0.45, 3.6, 0.45, P.wood)
    b.box(x, 3.7, z, 1.15, 0.35, 1.15, P.gold)
    glow.box(x, 4.15, z, 0.8, 0.8, 0.8, P.blue)
  }
}

function resident(hair: Color, coat: Color, trim: Color, x: number, z: number, staff: boolean): Group {
  const person = new Group()
  const b = new VoxelBuilder()
  const glow = new VoxelBuilder()
  for (const side of [-1, 1]) {
    b.box(side * 0.18, 0.34, 0, 0.22, 0.68, 0.27, P.deep)
    b.box(side * 0.18, 0.1, 0.07, 0.27, 0.2, 0.35, P.black)
    b.box(side * 0.39, 1.56, 0, 0.17, 0.9, 0.2, coat)
    b.box(side * 0.4, 1.03, 0.07, 0.16, 0.18, 0.18, P.skin)
  }
  b.box(0, 1.12, -0.02, 0.85, 1.25, 0.43, coat)
  b.box(0, 1.75, 0.08, 0.95, 0.1, 0.54, trim)
  b.box(0, 1.22, 0.22, 0.28, 0.78, 0.08, trim)
  b.box(0, 1.92, 0.05, 0.43, 0.2, 0.43, P.skin)
  b.box(0, 2.2, 0.05, 0.53, 0.47, 0.48, P.skin)
  b.box(0, 2.47, -0.08, 0.63, 0.22, 0.57, hair)
  b.box(-0.29, 2.15, -0.07, 0.13, 0.52, 0.5, hair)
  b.box(0.29, 2.15, -0.07, 0.13, 0.52, 0.5, hair)
  b.box(-0.14, 2.23, 0.301, 0.055, 0.055, 0.02, P.black)
  b.box(0.14, 2.23, 0.301, 0.055, 0.055, 0.02, P.black)
  b.box(0, 1.28, -0.36, 1.04, 1.1, 0.1, coat)
  if (staff) {
    b.box(-0.58, 1.5, 0.17, 0.08, 2.8, 0.08, P.gold)
    glow.box(-0.58, 2.98, 0.17, 0.35, 0.42, 0.35, P.violet)
  }
  addMesh(person, b)
  addMesh(person, glow, true)
  person.position.set(x, 0, z)
  return person
}

/** 歐風宅邸、村屋與森林的原創體素舞台；居民與遊戲角色均由幾何生成。 */
export function buildManor(): ManorBuild {
  const group = new Group()
  const b = new VoxelBuilder()
  const glow = new VoxelBuilder()
  const rng = createRng(451)
  const grass = new Mesh(new PlaneGeometry(210, 210), new MeshStandardMaterial({ color: P.lawn, roughness: 1 }))
  grass.rotation.x = -Math.PI / 2
  grass.receiveShadow = true
  group.add(grass)
  // 中庭的石板大道與薰衣草花圃讓玩家從開場就能辨認新舞台。
  for (let z = -33; z <= 53; z += 3.7) {
    for (const x of [-5.6, -2.8, 0, 2.8, 5.6]) b.box(x, 0.035, z, 2.65, 0.07, 3.45, jitter(P.path, rng, 0.09))
  }
  for (const { x, z } of MANOR_FLOWERBEDS) {
    b.box(x, 0.34, z, 3.4, 0.65, 3.5, P.stone)
    for (const dx of [-0.95, 0, 0.95]) {
      b.box(x + dx, 0.75, z, 0.16, 0.5, 0.16, P.leaf)
      b.box(x + dx, 1.05, z, 0.52, 0.52, 0.52, (z + dx) % 2 > 0 ? P.blossom : P.violet)
    }
  }
  hall(b, glow)
  for (const house of MANOR_HOUSES) villageHouse(b, glow, (house.minX + house.maxX) / 2, (house.minZ + house.maxZ) / 2, house.maxX - house.minX, house.maxZ - house.minZ)
  grove(b, glow, rng)
  addMesh(group, b)
  addMesh(group, glow, true)
  const people = [
    resident(P.mossHair, P.deep, P.violet, MANOR_PEOPLE[0].x, MANOR_PEOPLE[0].z, true),
    resident(P.copperHair, P.olive, P.gold, MANOR_PEOPLE[1].x, MANOR_PEOPLE[1].z, false),
  ]
  group.add(...people)
  return { group, people }
}
