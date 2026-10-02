import {
  Color, GLSL3, InstancedMesh, LessEqualDepth, Material, NoBlending, NoColorSpace,
  Scene, ShaderMaterial, Vector2, Vector4, WebGLRenderTarget,
  type Camera, type WebGLRenderer,
} from 'three'

export interface EnemyPart { mesh: InstancedMesh; instancesPerEnemy: 1 | 2 }

export function decodeEnemyPixels(pixels: Uint8Array, alive: readonly boolean[]) {
  if (pixels.length % 4 !== 0) throw new Error('invalid RGBA byte length')
  const pixelCounts = Array<number>(alive.length).fill(0)
  for (let i = 0; i < pixels.length; i += 4) {
    const encoded = pixels[i] + pixels[i + 1] * 256 + pixels[i + 2] * 65536
    if (encoded === 0) continue
    const id = encoded - 1
    if (id >= alive.length || !alive[id]) throw new Error(`unknown/dead enemy ID pixel: ${id}`)
    pixelCounts[id]++
  }
  return { visible: pixelCounts.filter(count => count > 0).length, pixelCounts,
    visibleIds: pixelCounts.flatMap((count, id) => count > 0 ? [id] : []) }
}

function idMaterial(instancesPerEnemy: number) {
  return new ShaderMaterial({
    glslVersion: GLSL3, uniforms: { uDivisor: { value: instancesPerEnemy } },
    vertexShader: `
      uniform int uDivisor;
      flat out uint vEnemyId;
      void main() {
        vEnemyId = uint(gl_InstanceID / uDivisor) + 1u;
        vec4 mvPosition = instanceMatrix * vec4(position, 1.0);
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      flat in uint vEnemyId;
      void main() {
        gl_FragColor = vec4(vec3(float(vEnemyId & 255u), float((vEnemyId >> 8u) & 255u), float((vEnemyId >> 16u) & 255u)) / 255.0, 1.0);
      }`,
    blending: NoBlending, toneMapped: false, depthTest: true, depthWrite: false, depthFunc: LessEqualDepth,
  })
}

/** Separate single-sample target, original-material depth, then only enemy ID colors. No game tick. */
export function captureEnemyVisibility(renderer: WebGLRenderer, scene: Scene, camera: Camera,
  parts: readonly EnemyPart[], alive: readonly boolean[]) {
  if (alive.length > 65535 || scene.overrideMaterial !== null) throw new Error('unsupported diagnostic scene')
  for (const part of parts) {
    if (![1, 2].includes(part.instancesPerEnemy) || part.mesh.count !== alive.length * part.instancesPerEnemy) {
      throw new Error('enemy part instance mapping/count mismatch')
    }
  }
  const size = renderer.getDrawingBufferSize(new Vector2())
  const width = Math.floor(size.x)
  const height = Math.floor(size.y)
  if (width < 1 || height < 1) throw new Error('invalid diagnostic framebuffer')
  const target = new WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false, samples: 0 })
  target.texture.colorSpace = NoColorSpace
  const pixels = new Uint8Array(width * height * 4)
  const idScene = new Scene()
  const idMaterials: ShaderMaterial[] = []
  const clonedMeshes: InstancedMesh[] = []
  const materialWrites = new Map<Material, boolean>()
  scene.traverse(object => {
    if (!('material' in object)) return
    const material = object.material as Material | Material[]
    for (const entry of Array.isArray(material) ? material : [material]) materialWrites.set(entry, entry.colorWrite)
  })
  const saved = { target: renderer.getRenderTarget(), viewport: renderer.getViewport(new Vector4()),
    scissor: renderer.getScissor(new Vector4()), scissorTest: renderer.getScissorTest(),
    clearColor: renderer.getClearColor(new Color()), clearAlpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear, shadows: renderer.shadowMap.enabled, background: scene.background }
  const start = performance.now()
  let depthSubmitMs = 0
  let idSubmitMs = 0
  let readbackMs = 0
  try {
    scene.updateMatrixWorld()
    for (const part of parts) {
      const mesh = part.mesh.clone(false)
      const material = idMaterial(part.instancesPerEnemy)
      idMaterials.push(material)
      clonedMeshes.push(mesh)
      mesh.material = material
      mesh.matrix.copy(part.mesh.matrixWorld)
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      idScene.add(mesh)
    }
    renderer.autoClear = false
    renderer.shadowMap.enabled = false
    renderer.setScissorTest(false)
    renderer.setRenderTarget(target)
    renderer.setViewport(0, 0, width, height)
    renderer.setClearColor(0, 0)
    renderer.clear(true, true, true)
    scene.background = null
    for (const material of materialWrites.keys()) material.colorWrite = false
    const depthStart = performance.now()
    renderer.render(scene, camera)
    depthSubmitMs = performance.now() - depthStart
    for (const [material, value] of materialWrites) material.colorWrite = value
    const idStart = performance.now()
    // Do not clear depth: opaque world/player/enemy occlusion was established above.
    renderer.render(idScene, camera)
    idSubmitMs = performance.now() - idStart
    const readStart = performance.now()
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)
    readbackMs = performance.now() - readStart
    if (renderer.getContext().isContextLost()) throw new Error('WebGL context lost during visibility capture')
    const decodeStart = performance.now()
    const counts = decodeEnemyPixels(pixels, alive)
    return { ...counts, width, height, aliveIds: alive.flatMap((value, id) => value ? [id] : []),
      camera: { projection: camera.projectionMatrix.toArray(), world: camera.matrixWorld.toArray() },
      thresholdPixels: 1, method: 'sceneDepthEnemyIdPixels', samples: 0,
      excludes: ['transparent depthWrite=false effects', 'post-processing', 'HUD/menu occlusion', 'human recognizability', '4x MSAA edge coverage'],
      timing: { depthSubmitMs, idSubmitMs, readbackMs, decodeMs: performance.now() - decodeStart,
        elapsedMs: performance.now() - start, gpuActiveMs: null,
        meaning: 'CPU elapsed/submission/readback wait; not exclusive CPU/GPU active time' },
      pixels,
    }
  } finally {
    for (const [material, value] of materialWrites) material.colorWrite = value
    scene.background = saved.background
    renderer.autoClear = saved.autoClear
    renderer.shadowMap.enabled = saved.shadows
    renderer.setRenderTarget(saved.target)
    renderer.setViewport(saved.viewport)
    renderer.setScissor(saved.scissor)
    renderer.setScissorTest(saved.scissorTest)
    renderer.setClearColor(saved.clearColor, saved.clearAlpha)
    for (const material of idMaterials) material.dispose()
    for (const mesh of clonedMeshes) mesh.dispose()
    target.dispose()
  }
}
