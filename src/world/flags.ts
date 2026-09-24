import { DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3, type Texture } from 'three'
import type { FlagSpot } from './castle.ts'

const WIDTH = 1.4
const HEIGHT = 2.6
/** 旗面朝下風處展開的方向（繞 Y 的角度）：往東略偏南。 */
export const WIND_YAW = -0.29

/** 全部軍旗共用一個實例化網格，在頂點著色器裡依位置錯開相位飄動。 */
export class Flags {
  readonly mesh: InstancedMesh
  private readonly time = { value: 0 }

  constructor(spots: readonly FlagSpot[], texture: Texture) {
    const geometry = new PlaneGeometry(WIDTH, HEIGHT, 8, 10)
    geometry.translate(WIDTH / 2, -HEIGHT / 2, 0)
    const material = new MeshStandardMaterial({ map: texture, side: DoubleSide, alphaTest: 0.5, roughness: 0.9 })
    const w = WIDTH.toFixed(2)
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          float fPhase = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
          float fx = position.x / ${w};
          float fWave = uTime * 4.2 - position.x * 2.6 + fPhase;
          float fSlope = 0.32 * (-2.6 * cos(fWave) * fx + sin(fWave) / ${w});
          objectNormal = normalize(vec3(-fSlope, 0.0, 1.0));`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.z += sin(fWave) * 0.32 * fx + sin(uTime * 2.3 + fPhase + position.y * 1.5) * 0.08 * fx;
          transformed.y -= fx * fx * 0.12;`,
        )
    }
    material.customProgramCacheKey = () => 'waving-flag'

    this.mesh = new InstancedMesh(geometry, material, spots.length)
    this.mesh.frustumCulled = false
    const matrix = new Matrix4()
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), WIND_YAW)
    const position = new Vector3()
    const scale = new Vector3()
    spots.forEach((s, i) => {
      position.set(s.x, s.y + s.height - 0.15, s.z)
      scale.setScalar(s.size)
      this.mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
    })
    this.mesh.instanceMatrix.needsUpdate = true
  }

  update(time: number): void {
    this.time.value = time
  }
}
