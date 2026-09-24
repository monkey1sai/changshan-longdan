import { AdditiveBlending, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Mesh, ShaderMaterial, Vector3 } from 'three'

const MAX = 64

const VERTEX = /* glsl */ `
attribute float aFade;
varying float vFade;
void main() {
  vFade = aFade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  gl_FragColor = vec4(uColor * vFade, vFade);
}
`

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t)
}

/** 槍尖刀光：記錄槍身兩點的軌跡形成帶狀網格，快速揮動時以 Catmull-Rom 補點讓弧線平滑。 */
export class Trail {
  readonly mesh: Mesh
  private readonly base = new Float32Array(MAX * 3)
  private readonly tip = new Float32Array(MAX * 3)
  private readonly times = new Float32Array(MAX)
  private n = 0
  private readonly positions = new Float32Array(MAX * 2 * 3)
  private readonly fade = new Float32Array(MAX * 2)
  private readonly geometry = new BufferGeometry()
  private readonly uniforms = { uColor: { value: new Color(1.6, 2.4, 3.4) } }
  private lifetime = 0.14

  constructor() {
    const pos = new Float32BufferAttribute(this.positions, 3)
    pos.setUsage(DynamicDrawUsage)
    const fade = new Float32BufferAttribute(this.fade, 1)
    fade.setUsage(DynamicDrawUsage)
    this.geometry.setAttribute('position', pos)
    this.geometry.setAttribute('aFade', fade)
    const index: number[] = []
    for (let j = 0; j < MAX - 1; j++) {
      const a = j * 2
      index.push(a, a + 1, a + 3, a, a + 3, a + 2)
    }
    this.geometry.setIndex(index)
    this.geometry.setDrawRange(0, 0)
    this.mesh = new Mesh(
      this.geometry,
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 6
  }

  /** 無雙時刀光改為金色並拉長。 */
  setStyle(musou: boolean): void {
    this.uniforms.uColor.value.setRGB(musou ? 4.2 : 1.6, musou ? 2.8 : 2.4, musou ? 0.9 : 3.4)
    this.lifetime = musou ? 0.22 : 0.14
  }

  clear(): void {
    this.n = 0
  }

  push(base: Vector3, tip: Vector3, time: number): void {
    if (this.n > 0) {
      const l = (this.n - 1) * 3
      const dist = Math.hypot(tip.x - this.tip[l], tip.y - this.tip[l + 1], tip.z - this.tip[l + 2])
      const steps = Math.min(6, Math.floor(dist / 0.22))
      if (steps > 0) {
        const pl = this.n >= 2 ? (this.n - 2) * 3 : l
        const lastTime = this.times[this.n - 1]
        for (let s = 1; s <= steps; s++) {
          const t = s / (steps + 1)
          const b: number[] = []
          const p: number[] = []
          for (let a = 0; a < 3; a++) {
            const nb = base.getComponent(a)
            const nt = tip.getComponent(a)
            b.push(catmullRom(this.base[pl + a], this.base[l + a], nb, nb + (nb - this.base[l + a]), t))
            p.push(catmullRom(this.tip[pl + a], this.tip[l + a], nt, nt + (nt - this.tip[l + a]), t))
          }
          this.add(b[0], b[1], b[2], p[0], p[1], p[2], lastTime + (time - lastTime) * t)
        }
      }
    }
    this.add(base.x, base.y, base.z, tip.x, tip.y, tip.z, time)
  }

  private add(bx: number, by: number, bz: number, tx: number, ty: number, tz: number, time: number): void {
    if (this.n === MAX) {
      this.base.copyWithin(0, 3)
      this.tip.copyWithin(0, 3)
      this.times.copyWithin(0, 1)
      this.n--
    }
    const i = this.n++
    this.base.set([bx, by, bz], i * 3)
    this.tip.set([tx, ty, tz], i * 3)
    this.times[i] = time
  }

  update(time: number): void {
    let drop = 0
    while (drop < this.n && time - this.times[drop] > this.lifetime) drop++
    if (drop > 0) {
      this.base.copyWithin(0, drop * 3, this.n * 3)
      this.tip.copyWithin(0, drop * 3, this.n * 3)
      this.times.copyWithin(0, drop, this.n)
      this.n -= drop
    }
    for (let j = 0; j < this.n; j++) {
      const age = Math.min(1, (time - this.times[j]) / this.lifetime)
      const f = (1 - age) * (1 - age)
      this.positions.set(this.base.subarray(j * 3, j * 3 + 3), j * 6)
      this.positions.set(this.tip.subarray(j * 3, j * 3 + 3), j * 6 + 3)
      this.fade[j * 2] = f * 0.12
      this.fade[j * 2 + 1] = f
    }
    this.geometry.setDrawRange(0, Math.max(0, this.n - 1) * 6)
    this.geometry.getAttribute('position').needsUpdate = true
    this.geometry.getAttribute('aFade').needsUpdate = true
  }
}
