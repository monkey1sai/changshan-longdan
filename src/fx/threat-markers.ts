import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, RingGeometry } from 'three'
import { Kind, State, type EnemyStore } from '../entities/enemies.ts'

/** 共用一個 draw call 標出正在蓄勢的敵兵，讓格擋方向有可讀的線索。 */
export class ThreatMarkers {
  readonly mesh: InstancedMesh
  private readonly matrix = new Matrix4()
  private readonly color = new Color()

  constructor(capacity: number) {
    const geometry = new RingGeometry(0.65, 0.82, 24)
    geometry.rotateX(-Math.PI / 2)
    this.mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), capacity)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  update(store: EnemyStore, time: number): void {
    let count = 0
    for (let i = 0; i < store.count; i++) {
      if (store.alive[i] === 0 || (store.state[i] !== State.Windup && store.state[i] !== State.Strike)) continue
      const radius = 1 + 0.1 * Math.sin(time * 16)
      this.matrix.makeScale(radius, 1, radius)
      this.matrix.setPosition(store.x[i], 0.045, store.z[i])
      this.mesh.setMatrixAt(count, this.matrix)
      this.color.setHex(store.kind[i] === Kind.Captain ? 0xff5f46 : 0xffc75b)
      this.mesh.setColorAt(count, this.color)
      count++
    }
    this.mesh.count = count
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor !== null) this.mesh.instanceColor.needsUpdate = true
  }
}
