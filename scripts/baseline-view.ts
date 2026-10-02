import shell from '../index.html?raw'
import viewSource from './baseline-view.ts?raw'
import visibilitySource from './lib/baseline-visibility.ts?raw'
import evidenceSource from './lib/baseline-evidence.ts?raw'
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
import {
  beginCase, copyRetainedPixels, createEvidenceRun, evidenceComplete, finalizeRecordings, preserveReadback,
  recordedError, recordingFailure, saveImage, snapshotAllowed, topDownRgba,
  type CaseEvidence, type EvidenceRun, type RecordedError,
} from './lib/baseline-evidence.ts'

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
panel.style.cssText = 'position:fixed;right:12px;top:48px;z-index:30;max-width:390px;max-height:85vh;overflow:auto;padding:12px;color:white;background:#161b22ed;border:1px solid #829ab1;font:14px/1.5 sans-serif;pointer-events:auto'
panel.innerHTML = '<b>E01 本機敵群量測</b><p style="margin:6px 0">可見數：場景深度遮擋後至少 1 個敵人像素。<br>後製、HUD 與玩家辨識能力另行驗收。</p><button id="capture-population" disabled>讀取敵群快照</button> <button id="test-visibility" disabled>可見數負例自測</button> <button id="export-baseline" disabled>匯出收證 JSON</button><pre id="baseline-status" style="white-space:pre-wrap;margin:6px 0">核對來源與趙雲載入狀態中…</pre><div id="case-images"></div><canvas id="id-preview" width="240" height="135" hidden style="display:block;width:240px;height:auto"></canvas>'
document.body.append(panel)
const captureButton = panel.querySelector<HTMLButtonElement>('#capture-population')!
const testButton = panel.querySelector<HTMLButtonElement>('#test-visibility')!
const exportButton = panel.querySelector<HTMLButtonElement>('#export-baseline')!
const caseImages = panel.querySelector<HTMLDivElement>('#case-images')!
const status = panel.querySelector<HTMLPreElement>('#baseline-status')!
const preview = panel.querySelector<HTMLCanvasElement>('#id-preview')!
let sourceVerified = false
let selfTestStarted = false
let activeCase: number | null = null
const errorObserver = {
  listenerStartedAt: new Date().toISOString(),
  coverage: 'window error and unhandledrejection events after listener installation only',
  consoleCoverage: 'NOT_CAPTURED',
  events: [] as (RecordedError & { runId: string | null; caseNumber: number | null; location?: string })[],
}
const debug: { provenance: unknown; samples: unknown[]; selfTests: EvidenceRun | null; errors: string[];
  diagnosticErrors: RecordedError[]; errorObserver: typeof errorObserver } = {
  provenance: null, samples: [], selfTests: null, errors: [], diagnosticErrors: [], errorObserver,
}
Object.assign(window, { __baselineVisual: debug })
window.addEventListener('error', event => {
  errorObserver.events.push({ ...recordedError(event.error ?? event.message, 'page:uncaught'),
    runId: debug.selfTests?.runId ?? null, caseNumber: activeCase,
    location: `${event.filename}:${event.lineno}:${event.colno}` })
})
window.addEventListener('unhandledrejection', event => {
  errorObserver.events.push({ ...recordedError(event.reason, 'page:unhandledrejection'),
    runId: debug.selfTests?.runId ?? null, caseNumber: activeCase })
})
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
  return new ImageData(topDownRgba(pixels, width, height, colored), width, height)
}

captureButton.addEventListener('click', async () => {
  try {
    if (!snapshotAllowed(debug.selfTests, sourceVerified, port.model.assetStatus.state === 'ready', !document.hidden, port.mode)) {
      throw new Error('verified source, seven passing self-tests and complete case artifacts required before population capture')
    }
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
    debug.diagnosticErrors.push(recordedError(error, 'diagnostic:population'))
    status.textContent = `FAIL：${String(error)}`
  }
})

function visibilitySelfTests(evidence: EvidenceRun) {
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
  const results = evidence.tests
  let nextCase = 0
  const run = (name: string, alive: boolean[], expected: number[]) => {
    const record = beginCase(evidence, nextCase++)
    activeCase = record.caseNumber
    // Depth uses the original GPU buffer, while ID clones copy CPU matrices.
    // Match production SoldierView.update's upload marker after each fixture change.
    enemies.instanceMatrix.needsUpdate = true
    try {
      const result = captureEnemyVisibility(renderer, scene, camera, [{ mesh: enemies, instancesPerEnemy: 1 }], alive)
      try { preserveReadback(record, result) }
      catch (error) { recordingFailure(record, error, 'copy-readback') }
      // Evidence errors never skip or replace this original assertion.
      if (JSON.stringify(result.visibleIds) !== JSON.stringify(expected)) throw new Error(`${name}: unexpected IDs ${result.visibleIds}`)
      results.push({ name, result: 'PASS', ids: result.visibleIds })
      record.functionalResult = 'PASS'
    } catch (error) {
      record.functionalResult = 'FAIL'
      record.functionalError = recordedError(error, 'functional:capture-or-assertion')
      throw error
    } finally { activeCase = null }
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
    const exceptionCase = beginCase(evidence, nextCase++)
    activeCase = exceptionCase.caseNumber
    const originalCallback = wall.onBeforeRender
    wall.onBeforeRender = () => { throw new Error('EXPECTED_DIAGNOSTIC_FAILURE') }
    let rejected = false
    try { captureEnemyVisibility(renderer, scene, camera, [{ mesh: enemies, instancesPerEnemy: 1 }], [true]) }
    catch (error) {
      rejected = String(error).includes('EXPECTED_DIAGNOSTIC_FAILURE')
      exceptionCase.caughtError = recordedError(error, rejected ? 'expected:caught' : 'unexpected:caught')
    }
    finally { wall.onBeforeRender = originalCallback }
    exceptionCase.restoration = { rejected, wallColorWrite: wallMaterial.colorWrite,
      rendererBefore, rendererAfter: rendererFingerprint() }
    exceptionCase.referenceImage = { caseNumber: 6, relationship: 'last successful ID readback before throw; not same-frame evidence' }
    if (!rejected || !wallMaterial.colorWrite || rendererBefore !== rendererFingerprint()) {
      const error = new Error('throw restoration failed')
      exceptionCase.functionalResult = 'FAIL'
      exceptionCase.functionalError = recordedError(error, 'functional:restoration')
      throw error
    }
    results.push({ name: 'injected render failure restores materials and renderer', result: 'PASS' })
    exceptionCase.functionalResult = 'PASS'
    activeCase = null
    evidence.gameplayUnchanged = gameBefore === gameplayFingerprint()
    evidence.rendererRestored = rendererBefore === rendererFingerprint()
    if (gameBefore !== gameplayFingerprint()) throw new Error('self-tests changed the live gameplay state')
    return { result: 'PASS', tests: results, gameplayUnchanged: true, rendererRestored: true, gpuActiveMs: null }
  } catch (error) {
    const incomplete = evidence.cases.find(record => record.functionalResult === 'IN_PROGRESS')
    if (incomplete) {
      incomplete.functionalResult = 'FAIL'
      incomplete.functionalError = recordedError(error, 'functional:fixture-or-restoration')
    }
    throw error
  } finally {
    activeCase = null
    geometry.dispose()
    material.dispose()
    enemies.dispose()
    wall.geometry.dispose()
    wallMaterial.dispose()
    alpha?.dispose()
  }
}
function encodeReadback(record: CaseEvidence, colored: boolean) {
  const pixels = copyRetainedPixels(record)
  if (!pixels || !record.measurement) throw new Error('retained readback unavailable')
  const width = record.measurement.width as number
  const height = record.measurement.height as number
  const image = document.createElement('canvas')
  image.width = width
  image.height = height
  const context = image.getContext('2d')
  if (!context) throw new Error('2D context unavailable for evidence encoding')
  context.putImageData(imageData(pixels, width, height, colored), 0, 0)
  return image.toDataURL('image/png')
}

function exceptionReport(record: CaseEvidence, evidence: EvidenceRun) {
  const lines = [
    '例外恢復報告；非 fixture／GPU 截圖', 'imageKind: exceptionReport; gpuReadback: false',
    `candidate: ${(evidence.provenance as { sourceHead?: string } | null)?.sourceHead ?? 'UNVERIFIED'}`,
    `run: ${evidence.runId}`, `case ${record.caseNumber}: ${record.name}`,
    `expected error: ${record.expected.error}; expected IDs: null; actual IDs: null`,
    `functionalResult: ${record.functionalResult}`, `actual caught: ${record.caughtError?.text ?? 'NO_CAUGHT_ERROR'}`,
    `rejected: ${record.restoration?.rejected}; wallColorWrite: ${record.restoration?.wallColorWrite}`,
    `renderer before: ${record.restoration?.rendererBefore ?? 'NOT_RECORDED'}`,
    `renderer after: ${record.restoration?.rendererAfter ?? 'NOT_RECORDED'}`,
    '參照第 6 例：throw 前最近成功 ID 圖，非本例同幀畫面。',
    'Actual caught stack:', record.caughtError?.stack ?? 'NO_STACK_PROVIDED',
  ].flatMap(line => line.split('\n').flatMap(part => part.match(/.{1,95}/gu) ?? ['']))
  const image = document.createElement('canvas')
  image.width = 1200
  image.height = 40 + lines.length * 24
  const context = image.getContext('2d')
  if (!context) throw new Error('2D context unavailable for exception report')
  context.fillStyle = '#161b22'
  context.fillRect(0, 0, image.width, image.height)
  context.fillStyle = '#fff'
  context.font = '18px monospace'
  lines.forEach((line, index) => context.fillText(line, 16, 30 + index * 24))
  return image.toDataURL('image/png')
}

function encodeCaseImages(evidence: EvidenceRun) {
  for (const record of evidence.cases) {
    if (record.functionalResult === 'NOT_RUN') continue
    if (record.imageKind === 'exceptionReport') {
      try { saveImage(record, 'exceptionReportPng', exceptionReport(record, evidence)) }
      catch (error) { recordingFailure(record, error, 'exception-report') }
    } else {
      for (const [kind, colored] of [['idRgbPng', false], ['previewPng', true]] as const) {
        try { saveImage(record, kind, encodeReadback(record, colored)) }
        catch (error) { recordingFailure(record, error, `${kind}-encoding`) }
      }
    }
  }
}

function showCaseImages(evidence: EvidenceRun) {
  caseImages.replaceChildren()
  for (const record of evidence.cases) {
    const row = document.createElement('p')
    row.textContent = `案例 ${record.caseNumber}：功能 ${record.functionalResult}／收證 ${record.recordingResult} `
    for (const [kind, png] of Object.entries(record.images)) {
      const link = document.createElement('a')
      link.href = png
      link.download = `${evidence.runId}-case-${record.caseNumber}-${kind}.png`
      link.textContent = kind === 'exceptionReportPng' ? '例外報告（非 GPU 圖）' : kind === 'idRgbPng' ? 'ID 原圖' : '識別色圖'
      link.style.cssText = 'color:#b5ddff;margin-right:8px'
      row.append(link)
    }
    caseImages.append(row)
  }
}

exportButton.addEventListener('click', () => {
  if (!debug.selfTests || ['IN_PROGRESS', 'PROCESSING'].includes(debug.selfTests.recordingResult)) return
  const data = { schema: 'e01-local-browser-export/v1', exportedAt: new Date().toISOString(), ...debug }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${debug.selfTests.runId}-evidence.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})

testButton.addEventListener('click', async () => {
  if (selfTestStarted) return
  selfTestStarted = true
  testButton.disabled = true
  captureButton.disabled = true
  const sourceHead = (debug.provenance as { sourceHead?: string } | null)?.sourceHead
  const evidence = createEvidenceRun(`${sourceHead?.slice(0, 7) ?? 'unverified'}-${crypto.randomUUID()}`, debug.provenance, [
    { name: 'one exposed enemy', expectedIds: [0], expectedError: null },
    { name: 'alive in-frustum enemy fully behind opaque wall', expectedIds: [], expectedError: null },
    { name: 'hidden wall reveals same ID again', expectedIds: [0], expectedError: null },
    { name: 'near enemy fully occludes far enemy', expectedIds: [0], expectedError: null },
    { name: 'dead zero matrix and off-camera enemy have no pixels', expectedIds: [0], expectedError: null },
    { name: 'original alpha-tested holes preserve visible enemy pixels', expectedIds: [0], expectedError: null },
    { name: 'injected render failure restores materials and renderer', expectedIds: null, expectedError: 'EXPECTED_DIAGNOSTIC_FAILURE' },
  ])
  debug.selfTests = evidence
  try {
    if (!sourceVerified || document.hidden) throw new Error('verified source and visible page required before self-tests')
    // The full original suite remains synchronous; no rAF/tick/await between captures and state assertions.
    Object.assign(evidence, visibilitySelfTests(evidence))
    evidence.functionalResult = 'PASS'
  } catch (error) {
    evidence.result = 'FAIL'
    evidence.functionalResult = 'FAIL'
    evidence.error = recordedError(error, 'functional:suite')
    debug.errors.push(String(error))
    debug.diagnosticErrors.push(recordedError(error, 'diagnostic:self-tests'))
  }
  // Encode/hash only copied data after the original synchronous assertions, including a failed case.
  encodeCaseImages(evidence)
  status.textContent = `功能 ${evidence.functionalResult}；收證 PROCESSING…`
  await finalizeRecordings(evidence, digest)
  showCaseImages(evidence)
  exportButton.disabled = false
  captureButton.disabled = !sourceVerified || !evidenceComplete(evidence) || port.model.assetStatus.state !== 'ready'
  status.textContent = `可見數正負例：${evidence.tests.length}／7 ${evidence.functionalResult}\n逐案例收證：${evidence.recordingResult}\n前六例保存 ID 像素；第七例為例外報告。\nConsole 紀錄須另行收集；本頁只觀察已啟用 listener 的 error／rejection。${evidence.error ? `\n${evidence.error.text}` : ''}`
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
  for (const [source, value] of [['scripts/baseline-view.ts', viewSource], ['scripts/lib/baseline-visibility.ts', visibilitySource],
    ['scripts/lib/baseline-evidence.ts', evidenceSource], ['scripts/baseline-view.html', pageSource]]) {
    if (await digest(value) !== manifest.runnerHashes[source]) throw new Error(`diagnostic source mismatch: ${source}`)
  }
  for (const [asset, expected] of Object.entries(manifest.assetHashes)) {
    const assetResponse = await fetch(`/${asset.replace(/^public\//, '')}`)
    if (!assetResponse.ok || await digest(new Uint8Array(await assetResponse.arrayBuffer())) !== expected) throw new Error(`asset hash mismatch: ${asset}`)
  }
  debug.provenance = { sourceHead: manifest.sourceHead, workingTreeStatus: manifest.workingTreeStatus,
    effectiveProfileHash: manifest.effectiveProfileHash, runnerHashes: manifest.runnerHashes, assetHashes: manifest.assetHashes,
    reviewedPlan: manifest.reviewedPlan, input: 'live browser snapshot; mode recorded; no deterministic replay claim' }
  sourceVerified = true
  testButton.disabled = false
  const waitReady = () => {
    if (port.model.assetStatus.state === 'ready') {
      captureButton.disabled = !evidenceComplete(debug.selfTests)
      status.textContent = `來源雜湊符合；趙雲 ready\n版本 ${manifest.sourceHead.slice(0, 7)}\n先執行可見數負例自測，再出陣讀取快照。`
    } else if (port.model.assetStatus.state === 'failed') status.textContent = '趙雲載入失敗；保留缺口，不能採作正式角色樣本。'
    else requestAnimationFrame(waitReady)
  }
  waitReady()
}
void verifySource().catch(error => {
  debug.errors.push(String(error))
  debug.diagnosticErrors.push(recordedError(error, 'diagnostic:source'))
  status.textContent = `FAIL：${String(error)}`
})
