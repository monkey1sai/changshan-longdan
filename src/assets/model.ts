import { Group, Mesh, MeshStandardMaterial, Texture, type ColorRepresentation, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export interface MaterialStyle {
  color?: ColorRepresentation
  roughness?: number
  metalness?: number
  emissive?: ColorRepresentation
  emissiveIntensity?: number
}
/** Paths are relative to public/, including in itch.io subdirectory iframes. */
export interface ModelAsset {
  path: string
  materials?: Readonly<Record<string, MaterialStyle>>
}
export function validateRenderable(root: Group): void {
  let vertices = 0
  root.traverse((object) => {
    if (object instanceof Mesh) vertices += object.geometry.attributes.position?.count ?? 0
  })
  if (vertices === 0) throw new Error('模型沒有可繪製的網格')
}
export function assetUrl(path: string): string {
  if (!path || /(^[/.\\]|[:?#\\])/.test(path) || path.split('/').some((p) => p === '..' || p === '.')) {
    throw new Error(`模型必須使用 public/ 下的相對路徑：${path}`)
  }
  return `${import.meta.env.BASE_URL}${path}`
}
/** Each loaded instance owns its resources. */
export async function loadModel(asset: ModelAsset): Promise<Group> {
  const { scene } = await new GLTFLoader().loadAsync(assetUrl(asset.path))
  try { applyMaterials(scene, asset.materials); return scene }
  catch (error) { disposeObject(scene); throw error }
}
export function applyMaterials(root: Object3D, styles: ModelAsset['materials']): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const style = styles?.[material.name] ?? styles?.['*']
      if (!style || !(material instanceof MeshStandardMaterial)) continue
      if (style.color !== undefined) material.color.set(style.color)
      if (style.emissive !== undefined) material.emissive.set(style.emissive)
      if (style.roughness !== undefined) material.roughness = style.roughness
      if (style.metalness !== undefined) material.metalness = style.metalness
      if (style.emissiveIntensity !== undefined) material.emissiveIntensity = style.emissiveIntensity
    }
  })
}
export function disposeObject(root: Object3D): void {
  const resources = new Set<{ dispose(): void }>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    resources.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material)
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value)
    }
  })
  for (const resource of resources) resource.dispose()
}
/** Swap only after validation. Failure retains the complete procedural visual. */
export class ModelSlot {
  readonly group = new Group()
  readonly ready: Promise<void>
  status: 'procedural' | 'loading' | 'ready' | 'fallback' = 'procedural'
  error: string | null = null
  private disposed = false
  constructor(fallback: Object3D, asset?: ModelAsset, validate: (model: Group) => void = validateRenderable) {
    this.group.add(fallback)
    this.ready = asset ? this.load(fallback, asset, validate) : Promise.resolve()
  }
  private async load(fallback: Object3D, asset: ModelAsset, validate: (model: Group) => void): Promise<void> {
    this.status = 'loading'
    let model: Group | undefined
    try {
      model = await loadModel(asset)
      if (this.disposed) { disposeObject(model); return }
      validate(model)
      this.group.add(model)
      fallback.visible = false
      this.status = 'ready'
    } catch (error) {
      if (model) disposeObject(model)
      this.status = 'fallback'
      this.error = error instanceof Error ? error.message : String(error)
    }
  }
  dispose(): void {
    this.disposed = true
    disposeObject(this.group)
    this.group.clear()
  }
}
