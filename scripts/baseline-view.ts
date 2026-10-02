import shell from '../index.html?raw'
import viewSource from './baseline-view.ts?raw'
import visibilitySource from './lib/baseline-visibility.ts?raw'
import pageSource from './baseline-view.html?raw'
import '../src/ui/style.css'
import {
  BoxGeometry, DataTexture, DoubleSide, Frustum, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, RGBAFormat, Scene, Sphere,
  Vector3, Vector4, Color, type WebGLRenderer,
} from 'three'
import { Game } from '../src/game.ts'
import { initInterface } from '../src/ui/interface.ts'
import type { EnemyStore } from '../src/entities/enemies.ts'
import type { CameraRig } from '../src/view/camera-rig.ts'
import type { Player } from '../src/entities/player.ts'
import { captureEnemyVisibility, type EnemyPart } from './lib/baseline-visibility.ts'

if (!import.meta.env.DEV) throw new Error('The diagnostic page requires the local development server')
const parsed = new DOMParser().parseFromString(shell, 'text/html')
document.body.replaceChildren(...Array.from(parsed.body.childNodes).filter(node => node.nodeName !== 'SCRIPT').map(node => document.importNode(node, true)))
initInterface()
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
const game = new Game(canvas)
game.start()

interface GameView {
  pipeline: { renderer: WebGLRenderer }
  scene: Scene
  rig: CameraRig
  enemies: EnemyStore
  player: Player
  soldiers: Record<'legs' | 'arms' | 'torso' | 'head' | 'spear' | 'sword' | 'shield' | 'plume', { mesh: InstancedMesh }>
  model: { assetStatus: { state: string } }
  mode: string
  clock: number
  simClock: number
  battleTime: number
  hitstop: number
}
const port = game as unknown as GameView
const parts: EnemyPart[] = ['legs', 'arms', 'torso', 'head', 'spear', 'sword', 'shield', 'plume'].map(name => ({
  mesh: port.soldiers[name as keyof GameView['soldiers']].mesh, instancesPerEnemy: name === 'legs' || name === 'arms' ? 2 : 1,
}))
const panel = document.createElement('aside')
panel.style.cssText = 'position:fixed;right:12px;top:48px;z-index:30;max-width:390px;padding:12px;color:white;background:#161b22ed;border:1px solid #829ab1;font:14px/1.5 sans-serif;pointer-events:auto'
panel.innerHTML = '<b>E01 本機敵群量測</b><p style="margin:6px 0">可見數：場景深度遮擋後至少 1 個敵人像素。<br>後製、HUD 與玩家辨識能力另行驗收。</p><button id="capture-population" disabled>讀取敵群快照</button> <button id="test-visibility" disabled>可見數負例自測</button><pre id="baseline-status" style="white-space:pre-wrap;margin:6px 0">核對來源與趙雲載入狀態中…</pre><canvas id="id-preview" width="240" height="135" hidden style="display:block;width:240px;height:auto"></canvas>'
document.body.append(panel)
const captureButton = panel.querySelector<HTMLButtonElement>('#capture-population')!
const testButton = panel.querySelector<HTMLButtonElement>('#test-visibility')!
const status = panel.querySelector<HTMLPreElement>('#baseline-status')!
const preview = panel.querySelector<HTMLCanvasElement>('#id-preview')!
const debug: { provenance: unknown; samples: unknown[]; selfTests: unknown; errors: string[] } = {
  provenance: null, samples: [], selfTests: null, errors: [],
}
Object.assign(window, { __baselineVisual: debug })
const digest = async (value: string | Uint8Array) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

function gameplayFingerprint() {
  const arrays = Object.fromEntries(Object.entries(port.enemies).filter(([, value]) => ArrayBuffer.isView(value))
    .map(([key, value]) => [key, Array.from(value as ArrayLike<number>)]))
  return JSON.stringify({ mode: port.mode, clock: port.clock, simClock: port.simClock, battleTime: port.battleTime,
    hitstop: port.hitstop, player: port.player, enemies: arrays, count: port.enemies.count,
    alive: port.enemies.aliveCount, attackers: port.enemies.attackerCount,
    instanceMatrices: parts.map(part => Array.from(part.mesh.instanceMatrix.array)) })
}

function rendererFingerprint() {
  const renderer = port.pipeline.renderer
  return JSON.stringify({ target: renderer.getRenderTarget()?.texture.uuid ?? null,
    viewport: renderer.getViewport(new Vector4()).toArray(), scissor: renderer.getScissor(new Vector4()).toArray(),
    scissorTest: renderer.getScissorTest(), autoClear: renderer.autoClear, shadows: renderer.shadowMap.enabled,
    clearColor: renderer.getClearColor(new Color()).toArray(), clearAlpha: renderer.getClearAlpha() })
}

function population() {
  const store = port.enemies
  const camera = port.rig.camera
  camera.updateMatrixWorld()
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  const sphere = new Sphere(new Vector3(), 1)
  let engaged = 0
  let tokens = 0
  let frustumProxy = 0
  const alive = Array.from(store.alive.subarray(0, store.count), value => value !== 0)
  for (let i = 0; i < store.count; i++) {
    if (!alive[i]) continue
    engaged += store.engaged[i]
    tokens += store.token[i]
    sphere.center.set(store.x[i], store.y[i] + store.scale[i], store.z[i])
    sphere.radius = store.scale[i]
    if (frustum.intersectsSphere(sphere)) frustumProxy++
  }
  if (tokens !== store.attackerCount) throw new Error('alive token/attackerCount invariant failed')
  return { aliveFlags: alive, alive: store.aliveCount, engaged, tokenAttackers: store.attackerCount, frustumProxy }
}

function imageData(pixels: Uint8Array, width: number, height: number, colored: boolean) {
  const image = new ImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4
      const destination = ((height - 1 - y) * width + x) * 4
      const id = pixels[source] + pixels[source + 1] * 256 + pixels[source + 2] * 65536
      for (let channel = 0; channel < 3; channel++) image.data[destination + channel] = colored && id
        ? (id * [67, 109, 173][channel]) % 230 + 25 : pixels[source + channel]
      image.data[destination + 3] = colored ? 255 : pixels[source + 3]
    }
  }
  return image
}

captureButton.addEventListener('click', async () => {
  try {
    if (document.hidden || port.model.assetStatus.state !== 'ready') throw new Error('visible page and ready Zhao Yun asset required')
    if (!['playing', 'paused'].includes(port.mode)) throw new Error('start a battle before capturing population')
    const counts = population()
    const before = gameplayFingerprint()
    const renderBefore = rendererFingerprint()
    const clocks = { clock: port.clock, simClock: port.simClock, battleTime: port.battleTime, mode: port.mode }
    const result = captureEnemyVisibility(port.pipeline.renderer, port.scene, port.rig.camera, parts, counts.aliveFlags)
    const unchanged = before === gameplayFingerprint()
    const rendererRestored = renderBefore === rendererFingerprint()
    if (!unchanged || !rendererRestored) throw new Error('diagnostic changed gameplay or failed to restore renderer state')
    const rawCanvas = document.createElement('canvas')
    rawCanvas.width = result.width
    rawCanvas.height = result.height
    rawCanvas.getContext('2d')!.putImageData(imageData(result.pixels, result.width, result.height, false), 0, 0)
    const colorCanvas = document.createElement('canvas')
    colorCanvas.width = result.width
    colorCanvas.height = result.height
    colorCanvas.getContext('2d')!.putImageData(imageData(result.pixels, result.width, result.height, true), 0, 0)
    const { pixels, ...measurement } = result
    const sample = { sample: debug.samples.length, capture: 'normal constructor; live battle snapshot with recorded mode, not deterministic kernel replay',
      provenance: debug.provenance, clocks, population: { alive: counts.alive, visible: result.visible,
        engaged: counts.engaged, tokenAttackers: counts.tokenAttackers, frustumProxy: counts.frustumProxy },
      assetStatus: { ...port.model.assetStatus }, viewport: [innerWidth, innerHeight], focus: document.hasFocus(),
      visibilityState: document.visibilityState, devicePixelRatio, gameplayUnchanged: unchanged, rendererRestored,
      measurement, rawPixelsSha256: await digest(pixels), idRgbPng: rawCanvas.toDataURL('image/png'), previewPng: colorCanvas.toDataURL('image/png') }
    debug.samples.push(sample)
    preview.hidden = false
    preview.getContext('2d')!.drawImage(colorCanvas, 0, 0, preview.width, preview.height)
    status.textContent = `樣本 ${sample.sample + 1}\n存活 ${counts.alive}｜深度可見 ${result.visible}\n交戰 ${counts.engaged}｜攻擊名額 ${counts.tokenAttackers}\n視錐估計 ${counts.frustumProxy}\n狀態未改變，渲染設定已恢復\n診斷含等待：${result.timing.elapsedMs.toFixed(1)}ms`
  } catch (error) {
    debug.errors.push(String(error))
    status.textContent = `FAIL：${String(error)}`
  }
})

function visibilitySelfTests() {
  const renderer = port.pipeline.renderer
  const scene = new Scene()
  const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshBasicMaterial()
  const enemies = new InstancedMesh(geometry, material, 3)
  enemies.frustumCulled = false
  enemies.count = 1
  enemies.setMatrixAt(0, new Matrix4())
  scene.add(enemies)
  const wallMaterial = new MeshBasicMaterial({ side: DoubleSide })
  const wall = new Mesh(new PlaneGeometry(4, 4), wallMaterial)
  wall.position.z = 2
  wall.visible = false
  scene.add(wall)
  const results: { name: string; result: 'PASS'; ids?: number[] }[] = []
  debug.selfTests = { result: 'IN_PROGRESS', tests: results }
  const run = (name: string, alive: boolean[], expected: number[]) => {
    // Depth uses the original GPU buffer, while ID clones copy CPU matrices.
    // Match production SoldierView.update's upload marker after each fixture change.
    enemies.instanceMatrix.needsUpdate = true
    const result = captureEnemyVisibility(renderer, scene, camera, [{ mesh: enemies, instancesPerEnemy: 1 }], alive)
    if (JSON.stringify(result.visibleIds) !== JSON.stringify(expected)) throw new Error(`${name}: unexpected IDs ${result.visibleIds}`)
    results.push({ name, result: 'PASS', ids: result.visibleIds })
  }
  let alpha: DataTexture | null = null
  const rendererBefore = rendererFingerprint()
  const gameBefore = gameplayFingerprint()
  try {
    run('one exposed enemy', [true], [0])
    wall.visible = true
    run('alive in-frustum enemy fully behind opaque wall', [true], [])
    wall.visible = false
    run('hidden wall reveals same ID again', [true], [0])
    enemies.count = 2
    enemies.setMatrixAt(0, new Matrix4().makeTranslation(0, 0, 1))
    enemies.setMatrixAt(1, new Matrix4())
    run('near enemy fully occludes far enemy', [true, true], [0])
    enemies.count = 3
    enemies.setMatrixAt(1, new Matrix4().makeScale(0, 0, 0))
    enemies.setMatrixAt(2, new Matrix4().makeTranslation(100, 0, 0))
    run('dead zero matrix and off-camera enemy have no pixels', [true, false, true], [0])
    enemies.count = 1
    enemies.setMatrixAt(0, new Matrix4())
    wall.visible = true
    alpha = new DataTexture(new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0]), 2, 2, RGBAFormat)
    alpha.needsUpdate = true
    wallMaterial.map = alpha
    wallMaterial.alphaTest = 0.5
    wallMaterial.needsUpdate = true
    run('original alpha-tested holes preserve visible enemy pixels', [true], [0])
    const originalCallback = wall.onBeforeRender
    wall.onBeforeRender = () => { throw new Error('EXPECTED_DIAGNOSTIC_FAILURE') }
    let rejected = false
    try { captureEnemyVisibility(renderer, scene, camera, [{ mesh: enemies, instancesPerEnemy: 1 }], [true]) }
    catch (error) { rejected = String(error).includes('EXPECTED_DIAGNOSTIC_FAILURE') }
    finally { wall.onBeforeRender = originalCallback }
    if (!rejected || !wallMaterial.colorWrite || rendererBefore !== rendererFingerprint()) throw new Error('throw restoration failed')
    results.push({ name: 'injected render failure restores materials and renderer', result: 'PASS' })
    if (gameBefore !== gameplayFingerprint()) throw new Error('self-tests changed the live gameplay state')
    return { result: 'PASS', tests: results, gameplayUnchanged: true, rendererRestored: true, gpuActiveMs: null }
  } finally {
    geometry.dispose()
    material.dispose()
    enemies.dispose()
    wall.geometry.dispose()
    wallMaterial.dispose()
    alpha?.dispose()
  }
}
testButton.addEventListener('click', () => {
  try {
    debug.selfTests = visibilitySelfTests()
    captureButton.disabled = port.model.assetStatus.state !== 'ready'
    status.textContent = '可見數正負例：7／7 PASS\n深度遮擋、恢復、敵人互擋、死亡、視錐外、alpha 缺口、例外恢復均通過。'
  } catch (error) {
    debug.selfTests = { ...(debug.selfTests as object ?? {}), result: 'FAIL', error: String(error) }
    captureButton.disabled = true
    debug.errors.push(String(error))
    status.textContent = `FAIL：${String(error)}`
  }
})

async function verifySource() {
  const path = new URLSearchParams(location.search).get('evidence') ?? '/release/e01/first-run/manifest.json'
  const url = new URL(path, location.href)
  if (url.origin !== location.origin || !url.pathname.startsWith('/release/e01/') || !url.pathname.endsWith('/manifest.json')) throw new Error('local E01 manifest required')
  const response = await fetch(url)
  if (!response.ok) throw new Error('E01 manifest unavailable; run trace:baseline first')
  const manifest = await response.json()
  const profileResponse = await fetch(new URL('effective-profile.json', url))
  if (!profileResponse.ok) throw new Error('effective profile unavailable')
  const profile = await profileResponse.json()
  if (await digest(JSON.stringify(profile)) !== manifest.effectiveProfileHash) throw new Error('effective profile hash mismatch')
  const loaders = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default' })
  for (const [source, expected] of Object.entries(profile.sourceHashes)) {
    const loader = loaders[`/${source}`]
    if (!loader || await digest(await loader() as string) !== expected) throw new Error(`source mismatch: ${source}`)
  }
  for (const [source, value] of [['scripts/baseline-view.ts', viewSource], ['scripts/lib/baseline-visibility.ts', visibilitySource], ['scripts/baseline-view.html', pageSource]]) {
    if (await digest(value) !== manifest.runnerHashes[source]) throw new Error(`diagnostic source mismatch: ${source}`)
  }
  for (const [asset, expected] of Object.entries(manifest.assetHashes)) {
    const assetResponse = await fetch(`/${asset.replace(/^public\//, '')}`)
    if (!assetResponse.ok || await digest(new Uint8Array(await assetResponse.arrayBuffer())) !== expected) throw new Error(`asset hash mismatch: ${asset}`)
  }
  debug.provenance = { sourceHead: manifest.sourceHead, workingTreeStatus: manifest.workingTreeStatus,
    effectiveProfileHash: manifest.effectiveProfileHash, runnerHashes: manifest.runnerHashes, assetHashes: manifest.assetHashes,
    reviewedPlan: manifest.reviewedPlan, input: 'live browser snapshot; mode recorded; no deterministic replay claim' }
  testButton.disabled = false
  const waitReady = () => {
    if (port.model.assetStatus.state === 'ready') {
      captureButton.disabled = (debug.selfTests as { result?: string } | null)?.result !== 'PASS'
      status.textContent = `來源雜湊符合；趙雲 ready\n版本 ${manifest.sourceHead.slice(0, 7)}\n先執行可見數負例自測，再出陣讀取快照。`
    } else if (port.model.assetStatus.state === 'failed') status.textContent = '趙雲載入失敗；保留缺口，不能採作正式角色樣本。'
    else requestAnimationFrame(waitReady)
  }
  waitReady()
}
void verifySource().catch(error => { debug.errors.push(String(error)); status.textContent = `FAIL：${String(error)}` })
