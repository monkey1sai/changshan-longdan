import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, NormalBlending, Points, ShaderMaterial } from 'three'
import { TAU } from '../core/math.ts'

const VERTEX = /* glsl */ `
uniform float uSizeScale;
attribute float aAlpha;
attribute float aSize;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uSizeScale / -mv.z;
  gl_Position = projectionMatrix * mv;
  vAlpha = aAlpha;
}
`

const FRAGMENT = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vAlpha;
  gl_FragColor = vec4(0.36, 0.28, 0.21, a);
}
`

/** 落地、倒地與衝擊波揚起的塵土。 */
export class Dust {
  readonly points: Points
  private readonly capacity: number
  private count = 0
  private readonly pos: Float32Array
  private readonly vel: Float32Array
  private readonly alpha: Float32Array
  private readonly size: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly grow: Float32Array
  private readonly geometry = new BufferGeometry()
  private readonly uniforms = { uSizeScale: { value: 500 } }

  constructor(capacity = 900) {
    this.capacity = capacity
    this.pos = new Float32Array(capacity * 3)
    this.vel = new Float32Array(capacity * 3)
    this.alpha = new Float32Array(capacity)
    this.size = new Float32Array(capacity)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)
    this.grow = new Float32Array(capacity)
    for (const [name, array, n] of [['position', this.pos, 3], ['aAlpha', this.alpha, 1], ['aSize', this.size, 1]] as const) {
      const attr = new Float32BufferAttribute(array, n)
      attr.setUsage(DynamicDrawUsage)
      this.geometry.setAttribute(name, attr)
    }
    this.geometry.setDrawRange(0, 0)
    this.points = new Points(
      this.geometry,
      new ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, blending: NormalBlending, transparent: true, depthWrite: false }),
    )
    this.points.frustumCulled = false
    this.points.renderOrder = 1
  }

  clear(): void {
    this.count = 0
  }

  puff(x: number, y: number, z: number, n: number, speed: number, rng: () => number): void {
    for (let k = 0; k < n; k++) {
      const a = rng() * TAU
      const s = speed * (0.4 + rng() * 0.6)
      this.spawn(x, y + 0.2, z, Math.cos(a) * s, 0.6 + rng() * 1.2, Math.sin(a) * s, 0.5 + rng() * 0.5, 0.6 + rng() * 0.6)
    }
  }

  /** 衝擊波的環狀塵土。 */
  ring(x: number, z: number, radius: number, n: number, rng: () => number): void {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rng() * 0.2
      const s = radius * (2.2 + rng() * 1.4)
      this.spawn(x + Math.cos(a) * 0.8, 0.3, z + Math.sin(a) * 0.8, Math.cos(a) * s, 0.8 + rng() * 1.6, Math.sin(a) * s, 0.9 + rng() * 0.8, 0.7 + rng() * 0.5)
    }
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number): void {
    if (this.count >= this.capacity) return
    const i = this.count++
    this.pos.set([x, y, z], i * 3)
    this.vel.set([vx, vy, vz], i * 3)
    this.size[i] = size
    this.grow[i] = size * 2.5
    this.life[i] = life
    this.maxLife[i] = life
  }

  update(dt: number, sizeScale: number): void {
    this.uniforms.uSizeScale.value = sizeScale
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt
      if (this.life[i] <= 0) {
        const last = --this.count
        if (i !== last) {
          this.pos.copyWithin(i * 3, last * 3, last * 3 + 3)
          this.vel.copyWithin(i * 3, last * 3, last * 3 + 3)
          this.size[i] = this.size[last]
          this.grow[i] = this.grow[last]
          this.life[i] = this.life[last]
          this.maxLife[i] = this.maxLife[last]
        }
        i--
        continue
      }
      const i3 = i * 3
      const drag = 1 - 4 * dt
      this.vel[i3] *= drag
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag - 0.5 * dt
      this.vel[i3 + 2] *= drag
      this.pos[i3] += this.vel[i3] * dt
      this.pos[i3 + 1] = Math.max(0.1, this.pos[i3 + 1] + this.vel[i3 + 1] * dt)
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt
      const k = this.life[i] / this.maxLife[i]
      this.size[i] += this.grow[i] * dt
      this.alpha[i] = 0.45 * k * k
    }
    this.geometry.setDrawRange(0, this.count)
    for (const name of ['position', 'aAlpha', 'aSize']) this.geometry.getAttribute(name).needsUpdate = true
  }
}
