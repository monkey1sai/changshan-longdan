import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MOVES, type MoveId } from '../combat/moves.ts'
import { Player } from '../entities/player.ts'
import { PlayerModel } from './player-model.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#preview')!
const renderer = new WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
renderer.shadowMap.enabled = true
const scene = new Scene()
scene.background = new Color('#141e28')
scene.fog = new Fog('#141e28', 7, 18)
const environment = new RoomEnvironment()
const pmrem = new PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(environment, .04).texture
scene.environmentIntensity = .65
environment.dispose()
pmrem.dispose()
scene.add(new HemisphereLight('#c8e0f1', '#434039', 1.6))
const key = new DirectionalLight('#fff2d8', 3)
key.position.set(3, 6, 4)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.normalBias = .02
scene.add(key)
const rim = new DirectionalLight('#96c8ff', 2)
rim.position.set(-3, 3, -3)
scene.add(rim)
const ground = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: '#1b2730', roughness: .94 }))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)
const camera = new PerspectiveCamera(36, 1, .03, 200)
const orbit = new OrbitControls(camera, canvas)
orbit.enableDamping = true
orbit.minDistance = .5
orbit.maxDistance = 14
function fullBody(): void {
  if (innerWidth < 700) {
    camera.position.set(4.5, 2.5, 7.5)
    orbit.target.set(0, .35, 0)
  } else {
    camera.position.set(2.8, 2, 4.7)
    orbit.target.set(-.35, 1, 0)
  }
}
fullBody()
const models = { refined: new PlayerModel(), voxel: new PlayerModel('voxel') }
models.voxel.group.visible = false
scene.add(models.refined.group, models.voxel.group)
const player = new Player()
player.reset(0, 0, 0)
let pose = 'stance'
let elapsed = 0
let frozen = false
let last = performance.now()
let selected: keyof typeof models = 'refined'
document.querySelectorAll<HTMLButtonElement>('[data-model]').forEach((button) => {
  button.onclick = () => {
    selected = button.dataset.model as keyof typeof models
    for (const [name, model] of Object.entries(models)) model.group.visible = name === selected
    document.querySelectorAll('[data-model]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
  }
})
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach((button) => {
  button.onclick = () => {
    pose = button.dataset.pose!
    elapsed = 0
    document.querySelectorAll('[data-pose]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
  }
})
document.querySelector<HTMLButtonElement>('#close-up')!.onclick = () => {
  camera.position.set(.45, 1.8, innerWidth < 700 ? 2.5 : 1.25)
  orbit.target.set(-.10, innerWidth < 700 ? 1.35 : 1.59, 0)
}
document.querySelector<HTMLButtonElement>('#full-body')!.onclick = fullBody
document.querySelector<HTMLButtonElement>('#freeze')!.onclick = (event) => {
  frozen = !frozen
  ;(event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(frozen))
}
function resize(): void {
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()
function frame(now: number): void {
  requestAnimationFrame(frame)
  const dt = frozen ? 0 : Math.min(.04, (now - last) / 1000)
  last = now
  elapsed += dt
  player.speed = pose === 'run' ? 7 : 0
  player.runPhase += dt * 12
  player.state = pose === 'guard' ? 'guard' : pose === 'dodge' ? 'dodge' : pose in MOVES ? 'attack' : 'move'
  player.stateTime = elapsed % .75
  player.move = pose in MOVES ? MOVES[pose as MoveId] : null
  player.moveTime = player.move ? elapsed % (player.move.duration + .3) : 0
  for (const model of Object.values(models)) model.update(player, dt, elapsed)
  orbit.update()
  renderer.render(scene, camera)
  const model = models[selected]
  document.getElementById('status')!.textContent = selected === 'voxel' ? '原始體素 · 對照' : model.assetStatus === 'ready' ? `精細角色已載入 · ${model.characterTriangles.toLocaleString()} 三角面` : model.assetStatus === 'fallback' ? `載入失敗：${model.assetError}` : '載入角色…'
}
requestAnimationFrame(frame)
