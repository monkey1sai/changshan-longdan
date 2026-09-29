import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from 'three'
import { createRng, TAU } from '../core/math.ts'
import { BARRACKS, BIG_FIRES, BRAZIERS, GATE_HALF, INNER, KEEP, STAIRS, WALL_HEIGHT, WALL_THICK } from './layout.ts'
import { SUN_DIR } from './sky.ts'
import { jitter, VoxelBuilder } from './voxel-builder.ts'

export interface FlagSpot {
  x: number
  y: number // 旗桿底部高度
  z: number
  height: number // 旗桿長度
  size: number // 旗面縮放
}

export interface FireSpot {
  x: number
  y: number
  z: number
  scale: number
}

export interface CastleBuild {
  group: Group
  flags: FlagSpot[]
  fires: FireSpot[] // 城上額外的火（角樓烽火）
}

const hex = (h: string) => new Color(h)
const P = {
  stone: hex('#8b8074'),
  stoneDark: hex('#62594f'),
  stoneLight: hex('#a59a8a'),
  red: hex('#962c1f'),
  wood: hex('#4a2e21'),
  woodLight: hex('#6f4a33'),
  roof: hex('#3a4350'),
  roofDark: hex('#2b3139'),
  gold: hex('#c29a45'),
  plaster: hex('#cdbfa8'),
  scorched: hex('#6b5d50'),
  ash: hex('#2d2724'),
  char: hex('#1d1916'),
  iron: hex('#35343a'),
}
// 自發光顏色（線性 HDR，交給 bloom）
const GLOW = {
  lantern: new Color(3.2, 0.5, 0.18),
  coals: new Color(4.5, 1.6, 0.35),
  ember: new Color(2.4, 0.7, 0.12),
}

type Side = 0 | 1 | 2 | 3 // 0 南(+z) 1 北(-z) 2 東(+x) 3 西(-x)

function place(side: Side, along: number, across: number): [number, number] {
  switch (side) {
    case 0:
      return [along, across]
    case 1:
      return [along, -across]
    case 2:
      return [across, along]
    case 3:
      return [-across, along]
  }
}

function wallBox(b: VoxelBuilder, side: Side, along: number, across: number, y0: number, y1: number, len: number, thick: number, color: Color): void {
  const [x, z] = place(side, along, across)
  const alongX = side < 2
  b.box(x, (y0 + y1) / 2, z, alongX ? len : thick, y1 - y0, alongX ? thick : len, color)
}

/** 堆疊式歇山頂：一層層內縮，最上方是屋脊與金色鴟吻，四角微微上翹。 */
function roof(b: VoxelBuilder, cx: number, y: number, cz: number, w: number, d: number, layers: number, color: Color, trim: Color, alongZ = false): number {
  const sx = (a: number, c: number) => (alongZ ? c : a)
  const sz = (a: number, c: number) => (alongZ ? a : c)
  b.box(cx, y + 0.12, cz, sx(w + 0.5, d + 0.5), 0.24, sz(w + 0.5, d + 0.5), trim)
  const h = 0.42
  const dark = color.clone().multiplyScalar(0.84)
  for (let i = 0; i < layers; i++) {
    const ld = d * (1 - i / layers)
    const lw = w - (d - ld)
    b.box(cx, y + 0.24 + h * (i + 0.5), cz, sx(lw, ld), h, sz(lw, ld), i % 2 === 0 ? color : dark)
  }
  const ridgeY = y + 0.24 + h * layers + 0.2
  const ridge = Math.max(1, w - d + 1.2)
  b.box(cx, ridgeY, cz, sx(ridge, 0.5), 0.4, sz(ridge, 0.5), P.roofDark)
  for (const s of [-1, 1]) {
    b.box(alongZ ? cx : cx + (s * ridge) / 2, ridgeY + 0.35, alongZ ? cz + (s * ridge) / 2 : cz, 0.4, 0.7, 0.4, trim)
  }
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      b.box(cx + s1 * (sx(w, d) / 2 + 0.15), y + 0.45, cz + s2 * (sz(w, d) / 2 + 0.15), 0.55, 0.35, 0.55, color)
    }
  }
  return ridgeY + 0.2
}

function buildWalls(b: VoxelBuilder, rng: () => number, flags: FlagSpot[]): void {
  const outer = INNER + WALL_THICK
  const mid = INNER + WALL_THICK / 2
  const spans: [Side, number, number][] = [
    [0, -outer, -GATE_HALF],
    [0, GATE_HALF, outer],
    [1, -outer, outer],
    [2, -outer, outer],
    [3, -outer, outer],
  ]
  for (const [side, from, to] of spans) {
    const n = Math.ceil((to - from) / 6)
    const len = (to - from) / n
    for (let k = 0; k < n; k++) {
      const along = from + len * (k + 0.5)
      wallBox(b, side, along, mid, 0, 1.6, len + 0.02, WALL_THICK + 0.7, jitter(P.stoneDark, rng, 0.05))
      wallBox(b, side, along, mid, 1.6, WALL_HEIGHT - 0.5, len + 0.02, WALL_THICK, jitter(P.stone, rng, 0.07))
      wallBox(b, side, along, mid, WALL_HEIGHT - 0.5, WALL_HEIGHT, len + 0.02, WALL_THICK + 0.25, jitter(P.stoneLight, rng, 0.04))
      wallBox(b, side, along, INNER + 0.3, WALL_HEIGHT, WALL_HEIGHT + 0.7, len + 0.02, 0.6, jitter(P.stone, rng, 0.05))
      wallBox(b, side, along, outer - 0.5, WALL_HEIGHT, WALL_HEIGHT + 0.9, len + 0.02, 1, jitter(P.stone, rng, 0.05))
    }
    for (let a = from + 1.2; a < to - 0.6; a += 2.4) {
      if (Math.abs(a) > outer - 7) continue
      wallBox(b, side, a, outer - 0.5, WALL_HEIGHT + 0.9, WALL_HEIGHT + 2.1, 1.3, 1, jitter(P.stone, rng, 0.08))
    }
    // 城垛上的旗與補給箱
    for (let a = from + 7; a < to - 7; a += 14) {
      if (Math.abs(a) > outer - 9) continue
      const [fx, fz] = place(side, a, outer - 1.5)
      b.box(fx, WALL_HEIGHT + 2.5, fz, 0.14, 5, 0.14, P.wood)
      b.box(fx, WALL_HEIGHT + 5.1, fz, 0.22, 0.25, 0.22, P.gold)
      flags.push({ x: fx, y: WALL_HEIGHT, z: fz, height: 5, size: 1 })
      const [cx, cz] = place(side, a + 3.5, INNER + 1.6)
      b.box(cx, WALL_HEIGHT + 0.45, cz, 0.9, 0.9, 0.9, jitter(P.woodLight, rng, 0.1), rng() * 0.6)
    }
  }

  // 城門：門楣、關閉的城門與門釘
  b.span(-GATE_HALF, 7.2, INNER, GATE_HALF, WALL_HEIGHT - 0.5, outer, jitter(P.stone, rng))
  b.span(-GATE_HALF - 0.4, 6.8, INNER - 0.2, GATE_HALF + 0.4, 7.4, INNER + 0.4, P.stoneLight)
  for (const s of [-1, 1]) {
    b.span(s * 0.05, 0, INNER + 1.6, s * GATE_HALF, 7.2, INNER + 2.2, jitter(P.wood, rng, 0.05))
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) b.box(s * (0.9 + i * 1.4), 1 + j * 1.3, INNER + 1.5, 0.18, 0.18, 0.12, P.gold)
    }
    b.box(s * 0.7, 3.2, INNER + 1.45, 0.35, 0.35, 0.1, P.gold)
  }
}

function buildGatehouse(b: VoxelBuilder, glow: VoxelBuilder, flags: FlagSpot[]): void {
  const y0 = WALL_HEIGHT
  const z0 = INNER + 0.8
  const z1 = INNER + WALL_THICK - 0.8
  const top = y0 + 5
  b.span(-10, y0, z0 - 0.3, 10, y0 + 0.4, z1 + 0.3, P.stoneLight)
  for (let i = 0; i <= 4; i++) {
    for (const z of [z0, z1]) b.box(-9 + i * 4.5, (y0 + 0.4 + top) / 2, z, 0.55, top - y0 - 0.4, 0.55, P.red)
  }
  b.span(-9, y0 + 0.4, z0 + 0.35, 9, top - 0.4, z1 - 0.35, P.plaster)
  for (let i = 0; i < 4; i++) b.box(-6.75 + i * 4.5, y0 + 2.6, z0 + 0.3, 2.2, 1.4, 0.12, P.wood)
  b.span(-9.6, top - 0.4, z0 - 0.3, 9.6, top + 0.1, z1 + 0.3, P.wood)
  roof(b, 0, top + 0.1, (z0 + z1) / 2, 23, 8.2, 5, P.roof, P.gold)
  for (const x of [-4.5, 4.5]) lantern(b, glow, x, top - 1.3, z0 - 0.5)
  for (const x of [-10.4, 10.4]) {
    b.box(x, y0 + 3.5, z0, 0.16, 7, 0.16, P.wood)
    flags.push({ x, y: y0, z: z0, height: 7, size: 1.3 })
  }
}

function lantern(b: VoxelBuilder, glow: VoxelBuilder, x: number, y: number, z: number): void {
  b.box(x, y + 0.45, z, 0.08, 0.3, 0.08, P.char)
  b.box(x, y + 0.3, z, 0.52, 0.08, 0.52, P.char)
  b.box(x, y - 0.3, z, 0.52, 0.08, 0.52, P.char)
  glow.box(x, y, z, 0.46, 0.55, 0.46, GLOW.lantern)
}

function buildTower(b: VoxelBuilder, rng: () => number, cx: number, cz: number, flags: FlagSpot[], fires: FireSpot[]): void {
  const half = 5
  const height = 13
  b.span(cx - half - 0.4, 0, cz - half - 0.4, cx + half + 0.4, 1.8, cz + half + 0.4, P.stoneDark)
  b.span(cx - half, 1.8, cz - half, cx + half, height, cz + half, jitter(P.stone, rng))
  b.span(cx - half - 0.3, height - 0.5, cz - half - 0.3, cx + half + 0.3, height, cz + half + 0.3, P.stoneLight)
  const top = height + 3.6
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.box(cx + sx * (half - 1), (height + top) / 2, cz + sz * (half - 1), 0.5, top - height, 0.5, P.red)
    b.box(cx + sx * (half - 1), height + 0.9, cz, 0.18, 0.18, 2 * half - 2, P.wood)
    b.box(cx, height + 0.9, cz + sx * (half - 1), 2 * half - 2, 0.18, 0.18, P.wood)
  }
  b.box(cx, height + 0.35, cz, 1.3, 0.7, 1.3, P.iron)
  fires.push({ x: cx, y: height + 0.75, z: cz, scale: 1.0 })
  const ridge = roof(b, cx, top, cz, 11.5, 11.5, 5, P.roof, P.gold)
  b.box(cx, ridge + 2.5, cz, 0.16, 5, 0.16, P.wood)
  flags.push({ x: cx, y: ridge, z: cz, height: 5, size: 1.35 })
}

function buildKeep(b: VoxelBuilder, glow: VoxelBuilder, rng: () => number, flags: FlagSpot[]): void {
  const k = KEEP
  b.span(k.minX - 0.4, 0, k.minZ - 0.4, k.maxX + 0.4, 0.6, k.maxZ + 0.4, P.stoneDark)
  b.span(k.minX, 0.6, k.minZ, k.maxX, k.height - 0.2, k.maxZ, jitter(P.stone, rng))
  b.span(k.minX - 0.25, k.height - 0.2, k.minZ - 0.25, k.maxX + 0.25, k.height, k.maxZ + 0.25, P.stoneLight)
  for (let x = k.minX + 0.5; x < k.maxX; x += 1.5) {
    if (Math.abs(x) < STAIRS.maxX + 0.5) continue
    b.box(x, k.height + 0.35, k.maxZ - 0.2, 0.3, 0.7, 0.3, P.stoneLight)
  }
  b.span(k.minX + 0.3, k.height + 0.6, k.maxZ - 0.35, STAIRS.minX - 0.5, k.height + 0.8, k.maxZ - 0.05, P.stoneLight)
  b.span(STAIRS.maxX + 0.5, k.height + 0.6, k.maxZ - 0.35, k.maxX - 0.3, k.height + 0.8, k.maxZ - 0.05, P.stoneLight)

  const steps = 5
  const depth = (STAIRS.maxZ - STAIRS.minZ) / steps
  for (let s = 0; s < steps; s++) {
    const z0 = STAIRS.minZ + s * depth
    b.span(STAIRS.minX, 0, z0, STAIRS.maxX, (k.height * (steps - s)) / steps, z0 + depth, jitter(P.stoneLight, rng, 0.04))
  }
  for (const sx of [-1, 1]) b.span(sx * STAIRS.maxX, 0, STAIRS.minZ, sx * (STAIRS.maxX + 0.6), k.height * 0.6, STAIRS.maxZ, P.stone)

  // 主殿
  const hx = 15
  const z0 = -52
  const z1 = -36
  const base = k.height
  const wallTop = base + 7
  b.span(-hx - 0.5, base, z0 - 0.5, hx + 0.5, base + 0.3, z1 + 0.5, P.stoneLight)
  b.span(-hx + 0.3, base + 0.3, z0 + 0.3, hx - 0.3, wallTop, z0 + 0.8, P.plaster)
  b.span(-hx + 0.3, base + 0.3, z0 + 0.3, -hx + 0.8, wallTop, z1 - 1.0, P.plaster)
  b.span(hx - 0.8, base + 0.3, z0 + 0.3, hx - 0.3, wallTop, z1 - 1.0, P.plaster)
  b.span(-hx + 0.8, base + 0.3, z1 - 1.4, hx - 0.8, wallTop, z1 - 1.0, P.plaster)
  b.span(-2.2, base + 0.3, z1 - 1.0, 2.2, base + 5, z1 - 0.9, P.wood)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) b.box(-1.4 + i * 1.4, base + 1.2 + j * 1.0, z1 - 0.85, 0.14, 0.14, 0.08, P.gold)
  for (const x of [-9, -5.5, 5.5, 9]) {
    b.span(x - 1.3, base + 2, z1 - 1.0, x + 1.3, base + 4.4, z1 - 0.92, P.woodLight)
    for (let i = -1; i <= 1; i++) b.box(x + i * 0.65, base + 3.2, z1 - 0.88, 0.08, 2.3, 0.05, P.char)
  }
  for (let i = 0; i < 10; i++) {
    const x = -hx + 0.6 + (i * (2 * hx - 1.2)) / 9
    b.box(x, (base + 0.3 + wallTop) / 2, z1 - 0.4, 0.62, wallTop - base - 0.3, 0.62, P.red)
  }
  for (const sx of [-1, 1]) b.box(sx * (hx - 0.4), (base + 0.3 + wallTop) / 2, z0 + 0.4, 0.62, wallTop - base - 0.3, 0.62, P.red)
  b.span(-hx - 0.2, wallTop - 0.2, z0, hx + 0.2, wallTop + 0.5, z1, P.wood)
  b.span(-hx - 0.3, wallTop + 0.5, z0 - 0.3, hx + 0.3, wallTop + 0.8, z1 + 0.3, P.gold)
  // 下層屋簷
  const skirtY = wallTop + 0.8
  b.box(0, skirtY + 0.12, (z0 + z1) / 2, 2 * hx + 5.5, 0.24, z1 - z0 + 5.5, P.gold)
  b.box(0, skirtY + 0.45, (z0 + z1) / 2, 2 * hx + 5, 0.42, z1 - z0 + 5, P.roof)
  b.box(0, skirtY + 0.87, (z0 + z1) / 2, 2 * hx + 2.4, 0.42, z1 - z0 + 2.4, P.roof.clone().multiplyScalar(0.84))
  // 上層
  const u0 = skirtY + 1.08
  b.span(-10, u0, z0 + 4, 10, u0 + 3.2, z1 - 4, P.plaster)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 9.8, u0 + 1.6, (z0 + z1) / 2 + sz * 3.8, 0.5, 3.2, 0.5, P.red)
  b.span(-10.3, u0 + 3.2, z0 + 3.7, 10.3, u0 + 3.6, z1 - 3.7, P.wood)
  roof(b, 0, u0 + 3.6, (z0 + z1) / 2, 26, 13, 6, P.roof, P.gold)
  for (const x of [-12, -6, 6, 12]) lantern(b, glow, x, wallTop - 1.0, z1 + 0.7)
  for (const x of [-9, 9]) {
    b.box(x, base + 4.5, k.maxZ - 1.5, 0.2, 9, 0.2, P.wood)
    b.box(x, base + 9.1, k.maxZ - 1.5, 0.3, 0.3, 0.3, P.gold)
    flags.push({ x, y: base, z: k.maxZ - 1.5, height: 9, size: 1.7 })
  }
}

function buildBarracks(b: VoxelBuilder): void {
  BARRACKS.forEach((r, idx) => {
    const burning = idx === 2 || idx === 3
    const cx = (r.minX + r.maxX) / 2
    const cz = (r.minZ + r.maxZ) / 2
    const wallH = 4.4
    b.span(r.minX + 0.3, 0, r.minZ + 0.3, r.maxX - 0.3, 0.4, r.maxZ - 0.3, P.stoneDark)
    b.span(r.minX + 0.6, 0.4, r.minZ + 0.6, r.maxX - 0.6, wallH, r.maxZ - 0.6, burning ? P.scorched : P.plaster)
    for (let z = r.minZ + 0.6; z <= r.maxZ - 0.5; z += (r.maxZ - r.minZ - 1.2) / 4) {
      for (const x of [r.minX + 0.6, r.maxX - 0.6]) b.box(x, wallH / 2 + 0.2, z, 0.42, wallH - 0.4, 0.42, P.wood)
    }
    for (const z of [r.minZ + 0.6, r.maxZ - 0.6]) b.box(cx, wallH / 2 + 0.2, z, 0.42, wallH - 0.4, 0.42, P.wood)
    b.span(r.minX + 0.3, wallH - 0.1, r.minZ + 0.3, r.maxX - 0.3, wallH + 0.35, r.maxZ - 0.3, P.wood)
    const doorX = r.minX > 0 ? r.minX + 0.55 : r.maxX - 0.55
    b.box(doorX, 1.6, cz, 0.15, 3.0, 2.2, P.wood)
    for (const dz of [-4, 4]) b.box(doorX, 2.4, cz + dz, 0.12, 1.2, 1.8, P.woodLight)
    roof(b, cx, wallH + 0.35, cz, r.maxZ - r.minZ + 1.6, r.maxX - r.minX + 1.6, 4, burning ? P.ash : P.roof, burning ? P.char : P.gold, true)
  })
}

function buildBraziers(b: VoxelBuilder, glow: VoxelBuilder, rng: () => number): void {
  for (const p of BRAZIERS) {
    b.box(p.x, 0.5, p.z, 0.8, 1.0, 0.8, jitter(P.stoneDark, rng))
    b.box(p.x, 1.12, p.z, 1.15, 0.26, 1.15, P.iron)
    glow.box(p.x, 1.28, p.z, 0.85, 0.08, 0.85, GLOW.coals)
  }
}

function buildWrecks(b: VoxelBuilder, glow: VoxelBuilder, rng: () => number): void {
  for (const f of BIG_FIRES) {
    if (f.y > 1) continue
    for (let i = 0; i < 14; i++) {
      const long = rng() < 0.6
      b.box(
        f.x + (rng() - 0.5) * 3.4,
        0.2 + rng() * 0.9,
        f.z + (rng() - 0.5) * 3.4,
        long ? 0.3 : 0.8,
        0.3 + rng() * 0.3,
        long ? 2 + rng() * 1.2 : 0.8,
        rng() < 0.5 ? P.char : P.wood,
        rng() * TAU,
      )
    }
    for (let i = 0; i < 10; i++) {
      glow.box(f.x + (rng() - 0.5) * 3, 0.08 + rng() * 0.4, f.z + (rng() - 0.5) * 3, 0.25, 0.12, 0.25, GLOW.ember, rng() * TAU)
    }
  }
}

/** 戰場殘留的焦土與餘燼；全部貼地，僅是合併網格上的視覺層，不加入碰撞或路徑障礙。 */
function buildBattlefieldScars(b: VoxelBuilder, glow: VoxelBuilder, rng: () => number): void {
  const scars: [number, number, number, number][] = [
    [-36, 24, 8, 4], [-18, -12, 11, 3], [25, 18, 9, 3.5], [40, -20, 7, 3],
    [-42, -30, 6, 2.5], [13, 42, 10, 3],
  ]
  for (const [x, z, w, d] of scars) {
    b.box(x, 0.012, z, w, 0.024, d, P.char, rng() * TAU)
    b.box(x + (rng() - 0.5) * w * 0.35, 0.03, z + (rng() - 0.5) * d * 0.35, w * 0.45, 0.018, d * 0.32, P.ash, rng() * TAU)
    for (let i = 0; i < 3; i++) {
      glow.box(x + (rng() - 0.5) * w * 0.65, 0.045, z + (rng() - 0.5) * d * 0.65, 0.09, 0.025, 0.09, GLOW.ember)
    }
  }
}

/** 城外遠山：兩圈鋸齒狀的剪影，頂端朝向夕陽的一側泛橙光。 */
function buildMountains(rng: () => number): Mesh {
  const positions: number[] = []
  const colors: number[] = []
  const ring = (radius: number, segments: number, minH: number, maxH: number, base: Color, top: Color) => {
    const heights: number[] = []
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * TAU
      const n = Math.sin(a * 3 + 1.3) * 0.35 + Math.sin(a * 7 + 0.4) * 0.25 + Math.sin(a * 13) * 0.15
      heights.push(minH + (maxH - minH) * (0.5 + 0.5 * n) * (0.7 + rng() * 0.3))
    }
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * TAU
      const a1 = ((i + 1) / segments) * TAU
      const p0 = [Math.sin(a0) * radius, -20, Math.cos(a0) * radius]
      const p1 = [Math.sin(a1) * radius, -20, Math.cos(a1) * radius]
      const t0 = [p0[0], heights[i], p0[2]]
      const t1 = [p1[0], heights[i + 1], p1[2]]
      const sunlit = (a: number) => Math.max(0, Math.sin(a) * SUN_DIR.x + Math.cos(a) * SUN_DIR.z)
      const topCol = (a: number) => top.clone().lerp(new Color(0.95, 0.45, 0.22), sunlit(a) ** 3 * 0.6)
      // 從圓心往外看時為逆時針，正面朝內
      for (const [p, c] of [
        [p0, base], [t0, topCol(a0)], [t1, topCol(a1)],
        [p0, base], [t1, topCol(a1)], [p1, base],
      ] as [number[], Color][]) {
        positions.push(p[0], p[1], p[2])
        colors.push(c.r, c.g, c.b)
      }
    }
  }
  ring(720, 180, 60, 170, new Color(0.06, 0.04, 0.09), new Color(0.2, 0.12, 0.2))
  ring(430, 140, 20, 70, new Color(0.035, 0.025, 0.04), new Color(0.1, 0.06, 0.09))
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, fog: false }))
}

/** 產生整座城池（合併成少數幾個網格）與旗幟、烽火的位置。 */
export function buildCastle(groundTexture: Texture): CastleBuild {
  const rng = createRng(2024)
  const b = new VoxelBuilder()
  const glow = new VoxelBuilder()
  const flags: FlagSpot[] = []
  const fires: FireSpot[] = []

  buildWalls(b, rng, flags)
  buildGatehouse(b, glow, flags)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) buildTower(b, rng, sx * 60, sz * 60, flags, fires)
  buildKeep(b, glow, rng, flags)
  buildBarracks(b)
  buildBraziers(b, glow, rng)
  buildWrecks(b, glow, rng)
  buildBattlefieldScars(b, glow, rng)

  const group = new Group()
  const structure = new Mesh(b.build(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 }))
  structure.castShadow = true
  structure.receiveShadow = true
  group.add(structure)
  group.add(new Mesh(glow.build(), new MeshBasicMaterial({ vertexColors: true })))

  const inner = new Mesh(new PlaneGeometry(INNER * 2, INNER * 2), new MeshStandardMaterial({ map: groundTexture, roughness: 0.95 }))
  inner.rotation.x = -Math.PI / 2
  inner.receiveShadow = true
  group.add(inner)

  const outside = new Mesh(new PlaneGeometry(2400, 2400), new MeshStandardMaterial({ color: '#3a2e25', roughness: 1 }))
  outside.rotation.x = -Math.PI / 2
  outside.position.y = -0.03
  outside.receiveShadow = true
  group.add(outside)

  group.add(buildMountains(rng))
  return { group, flags, fires }
}
