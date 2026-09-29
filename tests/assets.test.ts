import { afterEach, describe, expect, it, vi } from 'vitest'
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { assetUrl, applyMaterials, ModelSlot } from '../src/assets/model.ts'
import { LONGDAN_SPEAR } from '../src/assets/character.ts'
import { SPEAR_ANIMATION } from '../src/assets/player-animation.ts'
import { ENEMY_PARTS, type EnemyAsset } from '../src/assets/enemy.ts'
import { createAssetPack } from '../src/assets/default-pack.ts'
import { PlayerModel } from '../src/view/player-model.ts'
import { SoldierView } from '../src/view/soldier-view.ts'
import { Player } from '../src/entities/player.ts'
import { EnemyStore, squadSpawns } from '../src/entities/enemies.ts'
import { levelObstacles, levelSpawns } from '../src/world/levels.ts'
import { createRng } from '../src/core/math.ts'
import { blankPose, STANCE } from '../src/view/player-poses.ts'

afterEach(() => vi.restoreAllMocks())
function model(): Group {
  const group = new Group()
  group.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
  return group
}
function loaded(scene: Group): GLTF { return { scene } as GLTF }
function enemyModel(): { scene: Group; asset: EnemyAsset } {
  const scene = new Group()
  const parts = {} as EnemyAsset['parts'] as Record<(typeof ENEMY_PARTS)[number], string>
  for (const role of ENEMY_PARTS) {
    const mesh = new Mesh(new BoxGeometry(.2, .3, .4), new MeshStandardMaterial())
    mesh.name = `custom-${role}`
    parts[role] = mesh.name
    scene.add(mesh)
  }
  return { scene, asset: { path: 'models/enemy.glb', parts } }
}

describe('資源路徑、材質與原子回退', () => {
  it('維持 iframe 相對路徑並拒絕絕對或跳出路徑', () => {
    expect(assetUrl('models/hero.glb')).toBe(`${import.meta.env.BASE_URL}models/hero.glb`)
    for (const path of ['/hero.glb', '../hero.glb', 'https://site/hero.glb', 'models/../hero.glb', 'C:\\hero.glb']) {
      expect(() => assetUrl(path)).toThrow()
    }
  })
  it('具名材質可覆蓋 PBR 參數而不改幾何', () => {
    const root = model()
    const mesh = root.children[0] as Mesh<BoxGeometry, MeshStandardMaterial>
    mesh.material.name = 'armor'
    const geometry = mesh.geometry
    applyMaterials(root, { armor: { color: '#ff0000', roughness: .15, metalness: .9 } })
    expect(mesh.material.color.getHexString()).toBe('ff0000')
    expect(mesh.material.roughness).toBe(.15)
    expect(mesh.geometry).toBe(geometry)
  })
  it('載入期間保留原場景、成功後才交換，且不更動關卡碰撞', async () => {
    const originalObstacles = levelObstacles('moonlit-manor')
    const replacement = model()
    let resolve!: (gltf: GLTF) => void
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => new Promise((r) => { resolve = r }))
    const pack = createAssetPack({ worlds: { manor: { path: 'models/manor.glb' } } })
    const world = pack.createManor()
    const fallback = world.group.children[0]
    expect(fallback.visible).toBe(true)
    expect(world.slot.status).toBe('loading')
    resolve(loaded(replacement))
    await world.slot.ready
    expect(world.slot.status).toBe('ready')
    expect(fallback.visible).toBe(false)
    expect(replacement.parent).toBe(world.group)
    expect(levelObstacles('moonlit-manor')).toBe(originalObstacles)
    world.slot.dispose()
  })
  it.each(['missing', 'empty'])('失敗 %s 保留回退且提供錯誤', async (mode) => {
    const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync')
    if (mode === 'missing') loader.mockRejectedValue(new Error('404'))
    else loader.mockResolvedValue(loaded(new Group()))
    const fallback = model()
    const slot = new ModelSlot(fallback, { path: 'models/missing.glb' })
    await slot.ready
    expect(slot.status).toBe('fallback')
    expect(slot.error).toBeTruthy()
    expect(fallback.visible).toBe(true)
    slot.dispose()
  })
  it('釋放期間完成的載入不會重新附加，也會釋放 GPU 資源', async () => {
    let resolve!: (gltf: GLTF) => void
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => new Promise((r) => { resolve = r }))
    const replacement = model()
    const dispose = vi.spyOn((replacement.children[0] as Mesh).geometry, 'dispose')
    const slot = new ModelSlot(model(), { path: 'models/late.glb' })
    slot.dispose()
    resolve(loaded(replacement))
    await slot.ready
    expect(slot.group.children).toHaveLength(0)
    expect(dispose).toHaveBeenCalledOnce()
  })
})

describe('角色、武器與動畫分離', () => {
  it('自訂武器握點與刀光座標，無須修改 Player 或招式', async () => {
    const player = new Player()
    player.reset(0, 0, 0)
    const initialState = player.state
    const view = new PlayerModel({ character: null, animation: SPEAR_ANIMATION,
      weapon: { ...LONGDAN_SPEAR, tip: 3.2, trailBase: 1.2 } })
    await view.ready
    view.update(player, 1 / 60, 0)
    expect(view.tip.distanceTo(view.tipBase)).toBeCloseTo(2)
    expect(player.pos).toEqual(new Vector3())
    expect(player.state).toBe(initialState)
  })
  it('使用注入的動畫供應者且不控制遊戲狀態', () => {
    const sample = vi.fn((_player: Readonly<Player>, out: ReturnType<typeof blankPose>) => Object.assign(out, STANCE))
    const view = new PlayerModel({ character: null, weapon: LONGDAN_SPEAR, animation: { sample } })
    const player = new Player()
    const initialState = player.state
    view.update(player, 1 / 60, 0)
    expect(sample).toHaveBeenCalledOnce()
    expect(player.state).toBe(initialState)
  })
  it('回到站立時完整重設上一招姿勢，不殘留攻擊角度', () => {
    const out = blankPose()
    out.flip = 12
    out.spin = 8
    SPEAR_ANIMATION.sample(new Player(), out)
    expect(out).toEqual(STANCE)
  })
})

describe('敵人模型保留批次與行為合約', () => {
  it('替換全套部件後仍為 8 個批次、保留 300 人及受擊閃光', async () => {
    const { scene, asset } = enemyModel()
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(loaded(scene))
    const animate = vi.fn()
    const view = new SoldierView(320, { model: asset, animate })
    await view.ready
    const store = new EnemyStore(320)
    store.reset(squadSpawns(levelSpawns('fortress'), createRng(7)))
    store.flash[0] = .8
    view.applyColors(store, createRng(8))
    view.update(store, 0)
    expect(view.assetStatus).toBe('ready')
    expect(view.group.children).toHaveLength(8)
    expect(store.count).toBe(300)
    expect(animate).toHaveBeenCalledTimes(300)
    for (const child of view.group.children) {
      expect(child).toBeInstanceOf(InstancedMesh)
      const mesh = child as InstancedMesh
      expect(mesh.count === 300 || mesh.count === 600).toBe(true)
      expect(mesh.geometry.getAttribute('instanceFlash').getX(0)).toBeCloseTo(.8)
    }
  })
  it('缺一部件時不替換任何批次', async () => {
    const { scene, asset } = enemyModel()
    scene.remove(scene.getObjectByName(asset.parts.plume)!)
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(loaded(scene))
    const view = new SoldierView(320, { model: asset })
    const originals = view.group.children.map((child) => (child as Mesh).geometry)
    await view.ready
    expect(view.assetStatus).toBe('fallback')
    expect(view.assetError).toContain('plume')
    expect(view.group.children.map((child) => (child as Mesh).geometry)).toEqual(originals)
  })
})
