import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { createRng } from '../core/math.ts'

export interface FireSource {
  x: number
  y: number
  z: number
  scale: number
}

const FLAME_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSizeScale;
attribute vec3 aOrigin;
attribute float aSeed;
attribute float aScale;
varying float vLife;
void main() {
  float speed = 0.85 + fract(aSeed * 7.13) * 0.5;
  float life = fract(uTime * speed * 0.9 + aSeed);
  vLife = life;
  float ang = aSeed * 51.3 + uTime * (1.5 + fract(aSeed * 3.1));
  float radius = (0.12 + 0.3 * fract(aSeed * 13.7)) * aScale * (1.0 - life * 0.5);
  vec3 p = aOrigin;
  p.x += cos(ang) * radius + life * life * 0.25 * aScale;
  p.z += sin(ang) * radius;
  p.y += (life * 0.9 + life * life * 1.4) * aScale;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = aScale * (1.1 - life * 0.75) * (0.7 + 0.5 * fract(aSeed * 21.0));
  gl_PointSize = size * uSizeScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const FLAME_FRAGMENT = /* glsl */ `
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.2, 1.0, d);
  vec3 col = mix(vec3(7.0, 4.6, 2.2), vec3(4.2, 1.35, 0.25), smoothstep(0.0, 0.35, vLife));
  col = mix(col, vec3(0.7, 0.1, 0.02), smoothstep(0.35, 0.95, vLife));
  float fade = smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
  gl_FragColor = vec4(col, a * fade);
}
`

const SMOKE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSizeScale;
attribute vec3 aOrigin;
attribute float aSeed;
attribute float aScale;
varying float vLife;
void main() {
  float life = fract(uTime * (0.07 + fract(aSeed * 5.3) * 0.04) + aSeed);
  vLife = life;
  vec3 p = aOrigin;
  p.y += aScale * 1.2 + life * (18.0 + aScale * 6.0);
  p.x += life * life * 16.0 + sin(aSeed * 40.0 + uTime * 0.4) * (0.5 + life * 3.0);
  p.z += life * 5.0 + cos(aSeed * 23.0 + uTime * 0.3) * (0.5 + life * 3.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aScale * (1.2 + life * 6.0) * uSizeScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const SMOKE_FRAGMENT = /* glsl */ `
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.1, 1.0, d)) * 0.34;
  vec3 col = mix(vec3(0.5, 0.2, 0.08), vec3(0.075, 0.065, 0.07), smoothstep(0.0, 0.25, vLife));
  float fade = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.6, 1.0, vLife));
  gl_FragColor = vec4(col, a * fade);
}
`

const EMBER_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSizeScale;
uniform vec3 uCenter;
attribute vec3 aSeed;
varying float vTwinkle;
void main() {
  vec3 box = vec3(60.0, 22.0, 60.0);
  vec3 q = aSeed * box + vec3(uTime * 1.3, uTime * (0.9 + aSeed.x * 0.8), uTime * 0.4);
  vec3 p = uCenter + mod(q - uCenter, box) - box * 0.5;
  p.x += sin(uTime * 2.0 + aSeed.y * 30.0) * 0.4;
  vTwinkle = 0.5 + 0.5 * sin(uTime * 9.0 + aSeed.z * 50.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, (0.07 + aSeed.z * 0.06) * uSizeScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const EMBER_FRAGMENT = /* glsl */ `
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(vec3(5.0, 1.6, 0.3) * vTwinkle, 1.0 - smoothstep(0.3, 1.0, d));
}
`

function sourceGeometry(sources: readonly FireSource[], perScale: (scale: number) => number, seed: number): BufferGeometry {
  const rng = createRng(seed)
  const origin: number[] = []
  const seeds: number[] = []
  const scales: number[] = []
  for (const s of sources) {
    const n = perScale(s.scale)
    for (let i = 0; i < n; i++) {
      origin.push(s.x, s.y, s.z)
      seeds.push(rng())
      scales.push(s.scale)
    }
  }
  const geometry = new BufferGeometry()
  // position 只用來讓 three 知道頂點數；實際位置在著色器計算
  geometry.setAttribute('position', new Float32BufferAttribute(origin, 3))
  geometry.setAttribute('aOrigin', new Float32BufferAttribute(origin, 3))
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('aScale', new Float32BufferAttribute(scales, 1))
  return geometry
}

/** 火盆、燃燒屋頂的火焰與濃煙，以及飄在空中的火星；全部在 GPU 上以時間推算，CPU 不逐顆更新。 */
export class FireField {
  readonly group = new Group()
  private readonly uniforms = {
    uTime: { value: 0 },
    uSizeScale: { value: 500 },
    uCenter: { value: new Vector3() },
  }

  constructor(sources: readonly FireSource[]) {
    const flames = new Points(
      sourceGeometry(sources, (s) => Math.min(170, Math.round(30 * s * s + 10)), 1),
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: FLAME_VERTEX,
        fragmentShader: FLAME_FRAGMENT,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    flames.renderOrder = 3
    const smokeSources = sources.filter((s) => s.scale >= 1.2)
    const smoke = new Points(
      sourceGeometry(smokeSources, () => 46, 2),
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: SMOKE_VERTEX,
        fragmentShader: SMOKE_FRAGMENT,
        blending: NormalBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    smoke.renderOrder = 2
    const rng = createRng(3)
    const emberSeeds: number[] = []
    for (let i = 0; i < 520; i++) emberSeeds.push(rng(), rng(), rng())
    const emberGeometry = new BufferGeometry()
    emberGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(520 * 3), 3))
    emberGeometry.setAttribute('aSeed', new Float32BufferAttribute(emberSeeds, 3))
    const embers = new Points(
      emberGeometry,
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: EMBER_VERTEX,
        fragmentShader: EMBER_FRAGMENT,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    embers.renderOrder = 4
    for (const p of [flames, smoke, embers]) {
      p.frustumCulled = false
      this.group.add(p)
    }
  }

  /** sizeScale = 畫布高度（像素）/ (2·tan(fov/2))，讓粒子尺寸以公尺為單位。 */
  update(time: number, center: Vector3, sizeScale: number): void {
    this.uniforms.uTime.value = time
    this.uniforms.uSizeScale.value = sizeScale
    this.uniforms.uCenter.value.set(center.x, center.y + 8, center.z)
  }
}
