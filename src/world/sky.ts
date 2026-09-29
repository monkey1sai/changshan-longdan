import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Camera } from 'three'

/** 指向太陽的方向：西北方低空，黃昏約 17 度仰角。 */
export const SUN_DIR = new Vector3(-0.85, 0.3, -0.48).normalize()

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
uniform float uManor;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(vec3(1.55, 0.72, 0.32), vec3(0.95, 0.36, 0.2), smoothstep(0.0, 0.08, h));
  col = mix(col, vec3(0.26, 0.12, 0.28), smoothstep(0.06, 0.3, h));
  col = mix(col, vec3(0.045, 0.05, 0.16), smoothstep(0.25, 0.8, h));
  col = mix(col, vec3(0.3, 0.14, 0.12), smoothstep(0.0, -0.2, h));

  float sd = max(dot(d, uSunDir), 0.0);
  float horizonMask = 1.0 - smoothstep(0.0, 0.45, abs(h));
  col += vec3(1.4, 0.55, 0.18) * pow(sd, 5.0) * horizonMask * 0.9;
  col += vec3(1.6, 0.8, 0.4) * pow(sd, 48.0);
  col += vec3(18.0, 11.0, 6.0) * smoothstep(0.99935, 0.9997, sd);

  vec2 uv = d.xz / max(h + 0.15, 0.05) * 1.2 + vec2(uTime * 0.006, uTime * 0.002);
  float band = smoothstep(0.015, 0.1, h) * (1.0 - smoothstep(0.25, 0.55, h));
  float cloud = smoothstep(0.5, 0.78, fbm(uv)) * band;
  vec3 lit = mix(vec3(0.32, 0.12, 0.2), vec3(2.2, 0.95, 0.42), pow(sd, 2.5) * 0.9 + 0.1);
  col = mix(col, lit, cloud * 0.8);
  float moon = max(dot(d, normalize(vec3(-0.35, 0.62, -0.62))), 0.0);
  vec3 otherworld = mix(vec3(0.31, 0.29, 0.52), vec3(0.055, 0.09, 0.21), smoothstep(0.0, 0.72, h));
  otherworld += vec3(0.17, 0.12, 0.24) * cloud;
  otherworld += vec3(1.7, 1.85, 2.5) * pow(moon, 100.0);
  col = mix(col, otherworld, uManor);
  gl_FragColor = vec4(col, 1.0);
}
`

/** 跟著相機移動的天空球，輸出線性 HDR 顏色（最後由後製做色調映射）。 */
export class Sky {
  readonly mesh: Mesh
  private readonly material: ShaderMaterial

  constructor() {
    this.material = new ShaderMaterial({
      uniforms: { uSunDir: { value: SUN_DIR }, uTime: { value: 0 }, uManor: { value: 0 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: BackSide,
      depthWrite: false,
    })
    this.mesh = new Mesh(new SphereGeometry(900, 32, 16), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
  }

  update(camera: Camera, time: number): void {
    this.mesh.position.copy(camera.position)
    this.material.uniforms.uTime.value = time
  }

  setManor(selected: boolean): void {
    this.material.uniforms.uManor.value = selected ? 1 : 0
  }
}
