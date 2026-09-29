import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { Bone, Group, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { PlayerModel } from '../src/view/player-model.ts'
import { Player } from '../src/entities/player.ts'
import { MOVES } from '../src/combat/moves.ts'

const bytes = readFileSync(new URL('../public/models/zhaoyun.glb', import.meta.url))
const jsonSize = bytes.readUInt32LE(12)
const source = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString())

/** Keep the exact shipped geometry, skin and hierarchy; Node has no image decoder.
 * Texture loading is explicitly left to visible-browser acceptance.
 */
async function loadGeometry(): Promise<GLTF> {
  const doc = structuredClone(source)
  doc.materials = doc.materials.map((m: { name: string }) => ({ name: m.name }))
  delete doc.images
  delete doc.textures
  delete doc.samplers
  const json = Buffer.from(JSON.stringify(doc))
  const padded = Math.ceil(json.length / 4) * 4
  const bin = bytes.subarray(20 + jsonSize)
  const data = Buffer.alloc(20 + padded + bin.length, 0x20)
  bytes.copy(data, 0, 0, 12)
  data.writeUInt32LE(data.length, 8)
  data.writeUInt32LE(padded, 12)
  data.writeUInt32LE(0x4e4f534a, 16)
  json.copy(data, 20)
  bin.copy(data, 20 + padded)
  return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
}

afterEach(() => vi.restoreAllMocks())

describe('精細角色資產與動作接合', () => {
  it('發布資產全部內嵌、含完整蒙皮且在樣板預算內', () => {
    expect(source.asset.version).toBe('2.0')
    expect(source.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true)
    expect(source.images.every((i: { uri?: string; bufferView?: number }) => !i.uri && i.bufferView !== undefined)).toBe(true)
    expect(source.skins[0].joints.length).toBeGreaterThanOrEqual(50)
    expect(bytes.length).toBeLessThan(6 * 1024 * 1024)
  })

  it('全部招式切換後蒙皮保持有限範圍，並保留原槍尖與刀光座標', async () => {
    const gltf = await loadGeometry()
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf)
    const refined = new PlayerModel()
    const original = new PlayerModel('voxel')
    await refined.ready
    expect(refined.assetStatus).toBe('ready')
    const player = new Player()
    player.reset(4, -7, .73)
    const vertex = new Vector3()
    const meshes: SkinnedMesh[] = []
    gltf.scene.traverse((o) => { if (o instanceof SkinnedMesh) meshes.push(o) })
    expect(meshes.length).toBeGreaterThan(5)
    for (const move of Object.values(MOVES)) {
      player.state = move.id === 'MUSOU' ? 'musou' : 'attack'
      player.move = move
      for (let frame = 0; frame <= Math.ceil(move.duration * 60); frame++) {
        player.moveTime = frame / 60
        refined.update(player, 1 / 60, frame / 60)
        original.update(player, 1 / 60, frame / 60)
        expect(refined.tip.distanceTo(original.tip)).toBeLessThan(1e-9)
        expect(refined.tipBase.distanceTo(original.tipBase)).toBeLessThan(1e-9)
        if (frame % 12 !== 0) continue
        refined.group.updateMatrixWorld(true)
        for (const mesh of meshes) {
          mesh.skeleton.update()
          const attr = mesh.geometry.attributes.position
          for (let i = 0; i < attr.count; i += 47) {
            vertex.fromBufferAttribute(attr, i)
            mesh.applyBoneTransform(i, vertex)
            mesh.localToWorld(vertex)
            expect(Number.isFinite(vertex.lengthSq())).toBe(true)
            expect(vertex.distanceTo(player.pos), `${move.id} / ${frame} / ${mesh.name}`).toBeLessThan(3.5)
          }
        }
      }
    }
  })

  it('載入失敗會留下可見的原角色並提供明確狀態', async () => {
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('asset unavailable'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const model = new PlayerModel()
    await model.ready
    expect(model.assetStatus).toBe('fallback')
    expect(model.assetError).toBe('asset unavailable')
    let visible = 0
    model.group.traverse((o) => { if (o instanceof Mesh && o.visible) visible++ })
    expect(visible).toBeGreaterThan(10)
  })

  it('缺少骨架的資產不會取代可用角色', async () => {
    const scene = new Group()
    scene.add(new Bone())
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene } as GLTF)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const model = new PlayerModel()
    await model.ready
    expect(model.assetStatus).toBe('fallback')
    expect(model.assetError).toContain('pelvis')
  })

  it('跑步、防禦、翻滾與重新開局可重用同一骨架', async () => {
    const gltf = await loadGeometry()
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf)
    const model = new PlayerModel()
    await model.ready
    const player = new Player()
    player.reset(0, 0, 0)
    const capture = process.env.CHARACTER_EVIDENCE === '1'
    for (const pose of ['stance', 'run', 'guard', 'dodge'] as const) {
      player.state = pose === 'guard' || pose === 'dodge' ? pose : 'move'
      player.speed = pose === 'run' ? 7 : 0
      player.runPhase = .8
      player.stateTime = .15
      for (let f = 0; f < 20; f++) model.update(player, 1 / 60, f / 60)
      model.group.updateMatrixWorld(true)
      model.group.traverse((object) => {
        expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true)
      })
      // Optional offline geometry evidence. It does not establish browser acceptance.
      if (capture) {
        const meshes: unknown[] = []
        const v = new Vector3()
        model.group.traverseVisible((object) => {
          if (!(object instanceof Mesh)) return
          const geo = object.geometry
          const positions: number[] = []
          if (object instanceof SkinnedMesh) object.skeleton.update()
          for (let i = 0; i < geo.attributes.position.count; i++) {
            v.fromBufferAttribute(geo.attributes.position, i)
            if (object instanceof SkinnedMesh) object.applyBoneTransform(i, v)
            object.localToWorld(v)
            positions.push(v.x, v.y, v.z)
          }
          const mat = object.material as MeshStandardMaterial
          meshes.push({ name: object.name, positions, indices: geo.index ? Array.from(geo.index.array) : Array.from({ length: positions.length / 3 }, (_, i) => i), uv: geo.attributes.uv ? Array.from(geo.attributes.uv.array) : [], material: mat.name, color: mat.color.toArray(), metalness: mat.metalness, roughness: mat.roughness })
        })
        mkdirSync('artifacts/character', { recursive: true })
        writeFileSync(`artifacts/character/${pose}.json`, JSON.stringify(meshes))
      }
    }
    player.reset(20, -30, 1.4)
    model.resetCape()
    model.update(player, 1 / 60, 1)
    expect(model.tip.distanceTo(player.pos)).toBeLessThan(4)
    expect(model.assetStatus).toBe('ready')
  })
})
