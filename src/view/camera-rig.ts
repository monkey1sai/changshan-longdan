import { PerspectiveCamera, Vector3 } from 'three'
import { clamp, damp, lerp } from '../core/math.ts'
import { PLAY_LIMIT } from '../world/layout.ts'

const TITLE_LOOK = new Vector3(0, 4, -6)

/** 第三人稱跟隨鏡頭：可旋轉縮放、受擊震動、無雙時低角度環繞，標題畫面則環繞城池。 */
export class CameraRig {
  readonly camera: PerspectiveCamera
  yaw = Math.PI // 鏡頭朝向，定義同角色 facing
  distance = 9.2
  readonly focus = new Vector3()
  readonly forward = new Vector3(0, 0, -1) // 水平前方（移動輸入以此為準）
  readonly right = new Vector3(1, 0, 0)
  private trauma = 0
  private punch = 0
  private musou = 0
  private title = 1
  private readonly desired = new Vector3()
  private readonly look = new Vector3()
  private readonly orbit = new Vector3()

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(55, aspect, 0.1, 1500)
  }

  /** 震動強度累加（0..1），實際位移與強度平方成正比。 */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** 重擊時的視角瞬間收縮。 */
  kick(amount: number): void {
    this.punch = Math.max(this.punch, amount)
  }

  snap(target: Vector3, yaw: number): void {
    this.yaw = yaw
    this.focus.set(target.x, target.y + 1.35, target.z)
  }

  get focusDistance(): number {
    const near = this.camera.position.distanceTo(this.focus)
    return lerp(near, this.camera.position.distanceTo(TITLE_LOOK), this.title)
  }

  update(dt: number, target: Vector3, turn: number, zoom: number, musou: boolean, titleMode: boolean, time: number): void {
    this.yaw -= turn * 2.4 * dt
    this.distance = clamp(this.distance + zoom * 0.7, 5.5, 13)
    this.title = damp(this.title, titleMode ? 1 : 0, 2.2, dt)
    this.musou = damp(this.musou, musou ? 1 : 0, 5, dt)
    this.focus.x = damp(this.focus.x, target.x, 10, dt)
    this.focus.z = damp(this.focus.z, target.z, 10, dt)
    this.focus.y = damp(this.focus.y, target.y + 1.35, 6, dt)

    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    this.right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw))
    // 無雙時拉高拉遠並緩慢環繞，讓盤旋的龍整條入鏡
    const yaw = this.yaw + this.musou * Math.sin(time * 0.6) * 0.45
    const dist = lerp(this.distance, 11, this.musou)
    const height = lerp(4.4, 4.8, this.musou)
    const edge = PLAY_LIMIT + 0.5
    this.desired.set(
      clamp(this.focus.x - Math.sin(yaw) * dist, -edge, edge),
      Math.max(0.6, this.focus.y + height),
      clamp(this.focus.z - Math.cos(yaw) * dist, -edge, edge),
    )
    this.look.set(this.focus.x, this.focus.y + 0.15 + this.musou * 1.2, this.focus.z)

    if (this.title > 0.001) {
      const a = time * 0.045
      this.orbit.set(Math.sin(a) * 78, 38, Math.cos(a) * 78)
      this.desired.lerp(this.orbit, this.title)
      this.look.lerp(TITLE_LOOK, this.title)
    }
    this.camera.position.copy(this.desired)
    this.camera.lookAt(this.look)

    const s = this.trauma * this.trauma
    if (s > 1e-4) {
      const t = time * 32
      this.camera.translateX((Math.sin(t * 1.3) + Math.sin(t * 2.7 + 1.1) * 0.5) * 0.28 * s)
      this.camera.translateY((Math.sin(t * 1.7 + 2.3) + Math.sin(t * 3.1) * 0.5) * 0.22 * s)
      this.camera.rotateZ(Math.sin(t * 2.1 + 0.7) * 0.035 * s)
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.5)
    this.punch = Math.max(0, this.punch - dt * 6)

    const fov = lerp(55, 60, this.musou) + this.title * 5 - this.punch * 4
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }
}
