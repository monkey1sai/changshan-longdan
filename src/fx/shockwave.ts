import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { easeOutCubic } from '../core/math.ts'

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(0.78, 0.94, r) * (1.0 - smoothstep(0.96, 1.0, r));
  float fill = (1.0 - smoothstep(0.0, 1.0, r)) * 0.12;
  float a = (ring + fill) * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
`

const PILLAR_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float a = uAlpha * (1.0 - vUv.y) * (0.6 + 0.4 * sin(vUv.x * 62.83));
  gl_FragColor = vec4(uColor * a, a);
}
`

interface Effect {
  mesh: Mesh
  material: ShaderMaterial
  t: number
  duration: number
  radius: number
  height: number
  active: boolean
}

function effect(geometry: PlaneGeometry | CylinderGeometry, fragmentShader: string): Effect {
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })
  const mesh = new Mesh(geometry, material)
  mesh.visible = false
  mesh.frustumCulled = false
  mesh.renderOrder = 4
  return { mesh, material, t: 0, duration: 1, radius: 1, height: 1, active: false }
}

/** 落地與大招的地面衝擊波環，以及無雙收尾的光柱。 */
export class Shockwaves {
  readonly group = new Group()
  private readonly rings: Effect[] = []
  private readonly pillars: Effect[] = []

  constructor() {
    const plane = new PlaneGeometry(2, 2)
    plane.rotateX(-Math.PI / 2)
    for (let i = 0; i < 10; i++) {
      const e = effect(plane, RING_FRAGMENT)
      this.rings.push(e)
      this.group.add(e.mesh)
    }
    const cylinder = new CylinderGeometry(1, 1, 1, 32, 1, true)
    cylinder.translate(0, 0.5, 0)
    for (let i = 0; i < 3; i++) {
      const e = effect(cylinder, PILLAR_FRAGMENT)
      this.pillars.push(e)
      this.group.add(e.mesh)
    }
  }

  ring(x: number, z: number, radius: number, duration: number, color: Color): void {
    const e = this.rings.find((r) => !r.active) ?? this.rings[0]
    this.start(e, x, 0.08, z, radius, 1, duration, color)
  }

  pillar(x: number, z: number, radius: number, height: number, duration: number, color: Color): void {
    const e = this.pillars.find((p) => !p.active) ?? this.pillars[0]
    this.start(e, x, 0, z, radius, height, duration, color)
  }

  clear(): void {
    for (const e of [...this.rings, ...this.pillars]) {
      e.active = false
      e.mesh.visible = false
    }
  }

  update(dt: number): void {
    for (const e of this.rings) {
      if (!e.active) continue
      e.t += dt
      const k = Math.min(1, e.t / e.duration)
      const r = e.radius * (0.15 + 0.85 * easeOutCubic(k))
      e.mesh.scale.set(r, 1, r)
      e.material.uniforms.uAlpha.value = (1 - k) * (1 - k)
      if (k >= 1) this.stop(e)
    }
    for (const e of this.pillars) {
      if (!e.active) continue
      e.t += dt
      const k = Math.min(1, e.t / e.duration)
      const r = e.radius * (1 - 0.6 * k)
      e.mesh.scale.set(r, e.height * (0.4 + 0.6 * easeOutCubic(Math.min(1, k * 3))), r)
      e.material.uniforms.uAlpha.value = 1 - k
      if (k >= 1) this.stop(e)
    }
  }

  private start(e: Effect, x: number, y: number, z: number, radius: number, height: number, duration: number, color: Color): void {
    e.active = true
    e.t = 0
    e.duration = duration
    e.radius = radius
    e.height = height
    e.mesh.visible = true
    e.mesh.position.set(x, y, z)
    ;(e.material.uniforms.uColor.value as Color).copy(color)
  }

  private stop(e: Effect): void {
    e.active = false
    e.mesh.visible = false
  }
}
