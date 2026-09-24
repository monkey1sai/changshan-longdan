import {
  AdditiveBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
} from 'three'

const VERTEX = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iColor;
attribute float iSize;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vec4 head = modelViewMatrix * vec4(iPos, 1.0);
  vec4 tail = modelViewMatrix * vec4(iPos - iVel * 0.035, 1.0);
  vec2 dir = head.xy - tail.xy;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  vec3 center = mix(tail.xyz, head.xyz, position.x + 0.5);
  center.xy += dir * position.x * iSize + perp * position.y * iSize;
  gl_Position = projectionMatrix * vec4(center, 1.0);
  vColor = iColor;
  vUv = position.xy;
}
`

const FRAGMENT = /* glsl */ `
varying vec4 vColor;
varying vec2 vUv;
void main() {
  float d = abs(vUv.y) * 2.0;
  float a = (1.0 - d * d) * (1.0 - smoothstep(0.3, 0.5, abs(vUv.x)));
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}
`

/** 命中火花：沿速度方向拉長的高光四邊形（HDR 顏色，交給 bloom 發光）。 */
export class Sparks {
  readonly mesh: Mesh
  private readonly capacity: number
  private count = 0
  private readonly pos: Float32Array
  private readonly vel: Float32Array
  private readonly color: Float32Array
  private readonly size: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly base: Float32Array // 原始顏色，淡出時用
  private readonly geometry: InstancedBufferGeometry
  private readonly attrs: InstancedBufferAttribute[]

  constructor(capacity = 1400) {
    this.capacity = capacity
    this.pos = new Float32Array(capacity * 3)
    this.vel = new Float32Array(capacity * 3)
    this.color = new Float32Array(capacity * 4)
    this.base = new Float32Array(capacity * 3)
    this.size = new Float32Array(capacity)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)
    this.geometry = new InstancedBufferGeometry()
    this.geometry.setAttribute('position', new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    this.geometry.setIndex([0, 1, 2, 0, 2, 3])
    const attr = (name: string, array: Float32Array, size: number) => {
      const a = new InstancedBufferAttribute(array, size)
      a.setUsage(DynamicDrawUsage)
      this.geometry.setAttribute(name, a)
      return a
    }
    this.attrs = [attr('iPos', this.pos, 3), attr('iVel', this.vel, 3), attr('iColor', this.color, 4), attr('iSize', this.size, 1)]
    this.geometry.instanceCount = 0
    this.mesh = new Mesh(
      this.geometry,
      new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, blending: AdditiveBlending, transparent: true, depthWrite: false }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 5
  }

  clear(): void {
    this.count = 0
    this.geometry.instanceCount = 0
  }

  /** 命中點的火花；dir 為擊退方向。 */
  burst(x: number, y: number, z: number, dirX: number, dirZ: number, n: number, heavy: boolean, rng: () => number): void {
    for (let k = 0; k < n; k++) {
      const speed = (heavy ? 10 : 7) + rng() * 10
      const hot = rng()
      this.spawn(
        x, y, z,
        dirX * speed + (rng() - 0.5) * 9, 2 + rng() * 6, dirZ * speed + (rng() - 0.5) * 9,
        0.03 + rng() * 0.035,
        0.16 + rng() * 0.28,
        6 + hot * 2, 3 + hot * 2.2, 1 + hot * 1.6,
      )
    }
    // 命中瞬間的一團亮光
    this.spawn(x, y, z, 0, 0, 0, heavy ? 0.55 : 0.32, 0.07, 9, 7, 5)
  }

  /** 不帶方向的光點（龍身、無雙氣勢等）。 */
  glitter(x: number, y: number, z: number, r: number, g: number, b: number, rng: () => number): void {
    this.spawn(x, y, z, (rng() - 0.5) * 2, 1 + rng() * 2, (rng() - 0.5) * 2, 0.05 + rng() * 0.05, 0.4 + rng() * 0.4, r, g, b)
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, r: number, g: number, b: number): void {
    if (this.count >= this.capacity) return
    const i = this.count++
    this.pos.set([x, y, z], i * 3)
    this.vel.set([vx, vy, vz], i * 3)
    this.base.set([r, g, b], i * 3)
    this.size[i] = size
    this.life[i] = life
    this.maxLife[i] = life
  }

  update(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt
      if (this.life[i] <= 0) {
        const last = --this.count
        if (i !== last) {
          this.pos.copyWithin(i * 3, last * 3, last * 3 + 3)
          this.vel.copyWithin(i * 3, last * 3, last * 3 + 3)
          this.base.copyWithin(i * 3, last * 3, last * 3 + 3)
          this.size[i] = this.size[last]
          this.life[i] = this.life[last]
          this.maxLife[i] = this.maxLife[last]
        }
        i--
        continue
      }
      const i3 = i * 3
      const drag = 1 - 3 * dt
      this.vel[i3] *= drag
      this.vel[i3 + 2] *= drag
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag - 16 * dt
      this.pos[i3] += this.vel[i3] * dt
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt
      const k = this.life[i] / this.maxLife[i]
      this.color[i * 4] = this.base[i3]
      this.color[i * 4 + 1] = this.base[i3 + 1] * (0.4 + 0.6 * k)
      this.color[i * 4 + 2] = this.base[i3 + 2] * k
      this.color[i * 4 + 3] = k
    }
    this.geometry.instanceCount = this.count
    for (const a of this.attrs) a.needsUpdate = true
  }
}
