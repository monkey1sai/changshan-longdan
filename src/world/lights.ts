import { DirectionalLight, HemisphereLight, PointLight, type Scene, type Vector3 } from 'three'
import type { FireSource } from './fire.ts'
import { SUN_DIR } from './sky.ts'

const POINT_LIGHTS = 6

/** 夕陽、天光，以及跟著玩家移動、永遠照亮最近火堆的 6 盞火光。 */
export class Lighting {
  readonly sun: DirectionalLight
  private readonly points: PointLight[] = []
  private readonly sources: readonly FireSource[]
  private readonly order: number[]
  private readonly dist: Float32Array
  private fireLightsEnabled = true

  constructor(scene: Scene, sources: readonly FireSource[]) {
    this.sources = sources
    this.order = sources.map((_, i) => i)
    this.dist = new Float32Array(sources.length)

    this.sun = new DirectionalLight('#ffbb8c', 2.9)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const cam = this.sun.shadow.camera
    cam.left = -34
    cam.right = 34
    cam.top = 34
    cam.bottom = -34
    cam.near = 1
    cam.far = 240
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    this.sun.shadow.radius = 2
    scene.add(this.sun, this.sun.target)
    scene.add(new HemisphereLight('#8e93c4', '#5c4b3f', 1.0))

    for (let i = 0; i < POINT_LIGHTS; i++) {
      const light = new PointLight('#ff9a52', 0, 22, 2)
      this.points.push(light)
      scene.add(light)
    }
  }

  setFireLightsEnabled(enabled: boolean): void {
    this.fireLightsEnabled = enabled
  }

  update(focus: Vector3, time: number): void {
    const fx = Math.round(focus.x / 2) * 2
    const fz = Math.round(focus.z / 2) * 2
    this.sun.target.position.set(fx, 0, fz)
    this.sun.position.set(fx + SUN_DIR.x * 100, SUN_DIR.y * 100, fz + SUN_DIR.z * 100)
    this.sun.target.updateMatrixWorld()

    for (let i = 0; i < this.sources.length; i++) {
      const s = this.sources[i]
      this.dist[i] = (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2
    }
    this.order.sort((a, b) => this.dist[a] - this.dist[b])
    for (let k = 0; k < this.points.length; k++) {
      const light = this.points[k]
      if (!this.fireLightsEnabled) {
        light.intensity = 0
        continue
      }
      const idx = this.order[k]
      if (idx === undefined) {
        light.intensity = 0
        continue
      }
      const s = this.sources[idx]
      const flicker = 0.82 + 0.12 * Math.sin(time * 17 + idx * 3.1) + 0.06 * Math.sin(time * 41 + idx)
      light.position.set(s.x, s.y + 0.8 * s.scale, s.z)
      light.intensity = 26 * s.scale * flicker
      light.distance = 14 + 6 * s.scale
    }
  }
}
