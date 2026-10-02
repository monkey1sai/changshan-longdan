/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { Bone, Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOVES, type MoveId } from '../src/combat/moves.ts'
import { wrapAngle } from '../src/core/math.ts'
import { Arena } from '../src/entities/arena.ts'
import { MUSOU_MAX, Player, type PlayerControls } from '../src/entities/player.ts'
import { PlayerModel } from '../src/view/player-model.ts'
import { ZHAOYUN_ASSET, ZHAOYUN_DIMENSIONS as D } from '../src/view/zhaoyun-adapter.ts'

const idle: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }
const arena = new Arena(200, [])
const step = 1 / 60

/** Parse the real shipped geometry/skin. Texture loading is covered by Chrome.
 * Removing image references here avoids inventing a Node DOM/image decoder. */
async function asset(): Promise<GLTF> {
  const raw = readFileSync(new URL('../public/models/zhaoyun.glb', import.meta.url))
  const length = raw.readUInt32LE(12)
  const json = JSON.parse(raw.subarray(20, 20 + length).toString('utf8'))
  delete json.images; delete json.textures
  for (const m of json.materials ?? []) {
    delete m.pbrMetallicRoughness?.baseColorTexture
    delete m.pbrMetallicRoughness?.metallicRoughnessTexture
    delete m.normalTexture
  }
  const encoded = new TextEncoder().encode(JSON.stringify(json)), padded = Math.ceil(encoded.length / 4) * 4
  const bin = raw.subarray(20 + length)
  const output = new Uint8Array(20 + padded + bin.length)
  output.set(raw.subarray(0, 12)); output.fill(32, 20, 20 + padded); output.set(encoded, 20); output.set(bin, 20 + padded)
  const header = new DataView(output.buffer)
  header.setUint32(8, output.length, true); header.setUint32(12, padded, true); header.setUint32(16, 0x4e4f534a, true)
  return await new Promise((resolve, reject) => new GLTFLoader().parse(output.buffer, '', resolve, reject))
}
beforeEach(() => { vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(asset) })
afterEach(() => { vi.restoreAllMocks() })

async function fresh() {
  const player = new Player(); player.reset(0, 0, 0)
  const model = new PlayerModel(); model.resetCape()
  const fallback: Mesh[] = []
  model.group.traverse(o => { if (o instanceof Mesh) fallback.push(o) })
  await vi.waitFor(() => expect(model.assetStatus.state).toBe('ready'))
  model.update(player, step, 0)
  return { player, model, fallback }
}
function bones(model: PlayerModel) {
  const all: Bone[] = []; model.group.traverse((o) => { if (o instanceof Bone) all.push(o) })
  return all
}
function matrices(model: PlayerModel) { return bones(model).flatMap(b => b.matrixWorld.elements) }

describe('使用者趙雲真實 GLB 與程序動作橋接', () => {
  it('真實素材有完整骨架、正規四權重和內嵌資源，回退網格不可冒充完成', async () => {
    const { model, fallback } = await fresh()
    expect(bones(model).map(b => b.name).sort()).toEqual([...ZHAOYUN_ASSET.bones].sort())
    const body = model.group.getObjectByName(ZHAOYUN_ASSET.mesh)
    expect(body).toBeInstanceOf(SkinnedMesh)
    expect(model.assetStatus.triangles).toBeGreaterThan(29000)
    const mesh = body as SkinnedMesh, weights = mesh.geometry.getAttribute('skinWeight')
    for (let i = 0; i < weights.count; i++) {
      expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1, 4)
    }
    const raw = readFileSync(new URL('../public/models/zhaoyun.glb', import.meta.url))
    const json = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString('utf8'))
    expect(json.images).toHaveLength(3)
    expect(json.images.every((i: { uri?: string }) => i.uri === undefined)).toBe(true)
    expect(fallback.length).toBeGreaterThan(0)
    expect(fallback.every(mesh => !mesh.visible)).toBe(true)
  })
  it('17 招、取消與回復的骨骼／槍尖有限且未脱離角色；命中前已有揮動', async () => {
    const { model, player } = await fresh()
    const body = model.group.getObjectByName(ZHAOYUN_ASSET.mesh) as SkinnedMesh
    for (const id of Object.keys(MOVES) as MoveId[]) {
      player.move = MOVES[id]; player.state = id === 'MUSOU' ? 'musou' : 'attack'
      let firstTip: Vector3 | null = null, hitTip: Vector3 | null = null
      for (let t = 0; t <= MOVES[id].duration; t += step) {
        player.moveTime = t; model.update(player, step, t)
        if (firstTip === null) firstTip = model.tip.clone()
        if (t >= MOVES[id].hits[0].t0 && hitTip === null) hitTip = model.tip.clone()
        expect(matrices(model).every(Number.isFinite)).toBe(true)
        expect(model.animationStatus.rightGripError).toBeLessThan(.005)
        if (model.animationStatus.support > .98) expect(model.animationStatus.leftGripError).toBeLessThan(.01)
        body.skeleton.update()
        const positions = body.geometry.getAttribute('position'), point = new Vector3()
        for (let i = 0; i < positions.count; i += 431) {
          point.fromBufferAttribute(positions, i); body.applyBoneTransform(i, point); body.localToWorld(point)
          expect(point.distanceTo(player.pos)).toBeLessThan(4)
        }
      }
      expect(hitTip!.distanceTo(firstTip!)).toBeGreaterThan(.08)
    }
  })
  it('命中停頓中骨骼與槍尖保持，恢復後使用相同招式時間', async () => {
    const { model, player } = await fresh()
    player.update(step, { ...idle, attack: true }, () => null, arena)
    for (let i = 0; i < 7; i++) { player.update(step, idle, () => null, arena); model.update(player, step, i * step) }
    const before = matrices(model), tip = model.tip.clone(), time = player.moveTime
    for (let i = 0; i < 12; i++) model.update(player, 0, .2)
    matrices(model).forEach((value, i) => expect(value).toBeCloseTo(before[i], 9))
    expect(model.tip.distanceTo(tip)).toBe(0)
    player.update(step, idle, () => null, arena); model.update(player, step, .2 + step)
    expect(player.moveTime).toBeCloseTo(time + step)
  })
  it('完整連招與蓄力取消用正式 Player 更新，不會中途回到 move', async () => {
    const { model, player } = await fresh()
    const seen: string[] = []
    for (let f = 0; f < 360; f++) {
      player.update(step, { ...idle, attack: f < 200 && f % 6 === 0 }, () => null, arena)
      model.update(player, step, f * step)
      for (const event of player.events) if (event.type === 'moveStart') seen.push(event.moveId)
    }
    expect(seen.slice(0, 6)).toEqual(['N1', 'N2', 'N3', 'N4', 'N5', 'N6'])
    expect(player.state).toBe('move')
    player.update(step, { ...idle, attack: true }, () => null, arena)
    for (let f = 0; f < 18; f++) player.update(step, { ...idle, charge: f === 8 }, () => null, arena)
    expect(player.move?.id).toBe('C2')
    while (player.move !== null && player.moveTime < player.move.cancel + step) player.update(step, idle, () => null, arena)
    player.update(step, { ...idle, dodge: true }, () => null, arena)
    expect(player.state).toBe('dodge')
  })
  it('無雙、倒地、死亡後重新開局，模型不殘留翻轉或武器位置', async () => {
    const { model, player } = await fresh()
    const expected = matrices(model)
    player.musou = MUSOU_MAX; player.update(step, { ...idle, musou: true }, () => null, arena)
    for (let f = 0; f < 245; f++) { player.update(step, idle, () => null, arena); model.update(player, step, f * step) }
    expect(player.state).toBe('move')
    player.takeHit(30, true, 0, 2); model.update(player, step, 5)
    expect(player.state).toBe('down')
    player.invuln = 0; player.takeHit(2000, false, 0, 2); model.update(player, step, 6)
    expect(player.state).toBe('dead')
    player.reset(0, 0, 0); model.resetCape(); model.update(player, step, 0)
    matrices(model).forEach((value, i) => expect(value).toBeCloseTo(expected[i], 7))
  })
  it('角色世界位移只來自 Player，不會加入第二次 root motion', async () => {
    const { model, player } = await fresh()
    const pelvis = model.group.getObjectByName('pelvis')!, first = pelvis.getWorldPosition(new Vector3())
    player.pos.set(10, 0, -12); model.update(player, step, step)
    expect(pelvis.getWorldPosition(new Vector3()).sub(first).toArray()).toEqual([10, 0, -12])
  })
  it('同招 N1 連續重觸發，會重新播放而非停留在上一招末端', async () => {
    const { model, player } = await fresh()
    player.move = MOVES.N1; player.state = 'attack'
    const samples: Vector3[] = []
    for (let repeat = 0; repeat < 2; repeat++) {
      for (let f = 0; f <= 26; f++) {
        player.moveTime = f * step; model.update(player, step, repeat + f * step)
        if (f === 6) samples.push(model.tip.clone())
      }
    }
    expect(samples[0].distanceTo(samples[1])).toBeLessThan(.00001)
  })
  it('穩速跑步的著地腳不隨角色持續滑動，停止後兩腳接地', async () => {
    const { model, player } = await fresh()
    let compared = 0
    let previous: number[][] | null = null
    for (let f = 0; f < 160; f++) {
      player.update(step, { ...idle, moveZ: 1 }, () => null, arena); model.update(player, step, f * step)
      const feet = model.animationStatus.feet
      if (f > 80 && previous) for (let side = 0; side < 2; side++) {
        if (Math.abs(feet[side][1] - D.soleAnchorY) < .0001 && Math.abs(previous[side][1] - D.soleAnchorY) < .0001) {
          expect(Math.hypot(feet[side][0] - previous[side][0], feet[side][2] - previous[side][2])).toBeLessThan(.001)
          compared++
        }
      }
      previous = feet
    }
    expect(compared).toBeGreaterThan(20)
    for (let f = 0; f < 90; f++) { player.update(step, idle, () => null, arena); model.update(player, step, 3 + f * step) }
    for (const foot of model.animationStatus.feet) expect(foot[1]).toBeCloseTo(D.soleAnchorY, 5)
  })
  it('實際靴底蒙皮頂點在待機時貼近地面', async () => {
    const { model } = await fresh()
    const mesh = model.group.getObjectByName(ZHAOYUN_ASSET.mesh) as SkinnedMesh
    mesh.skeleton.update()
    const positions = mesh.geometry.getAttribute('position'), joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
    const footIndices = ['foot_l', 'foot_r'].map(name => mesh.skeleton.bones.findIndex(b => b.name === name))
    const lows = [Infinity, Infinity], point = new Vector3()
    for (let i = 0; i < positions.count; i++) {
      const side = footIndices.indexOf(joints.getX(i))
      if (side < 0 || weights.getX(i) < .99) continue
      point.fromBufferAttribute(positions, i); mesh.applyBoneTransform(i, point); mesh.localToWorld(point)
      lows[side] = Math.min(lows[side], point.y)
    }
    for (const low of lows) { expect(low).toBeGreaterThan(-.002); expect(low).toBeLessThan(.02) }
  })
  it('180 度受擊轉向平滑且可凍結，攻擊在第一命中窗口前對準正式朝向', async () => {
    const { model, player } = await fresh()
    player.takeHit(20, false, 0, -2)
    expect(Math.abs(player.facing)).toBeCloseTo(Math.PI)
    model.update(player, step, step)
    const first = model.animationStatus.visualFacing
    expect(Math.abs(first)).toBeGreaterThan(0)
    expect(Math.abs(first)).toBeLessThan(.4)
    model.update(player, 0, step)
    expect(model.animationStatus.visualFacing).toBe(first)
    for (let f = 1; f < 9; f++) model.update(player, step, f * step)
    expect(wrapAngle(model.animationStatus.visualFacing - player.facing)).toBeCloseTo(0)
    player.reset(0, 0, 0); model.resetCape(); model.update(player, step, 0)
    player.update(step, { ...idle, attack: true }, () => ({ x: 0, z: -2 }), arena)
    while (player.moveTime < player.move!.hits[0].t0) {
      model.update(player, step, player.moveTime)
      player.update(step, idle, () => null, arena)
    }
    model.update(player, step, player.moveTime)
    expect(wrapAngle(model.animationStatus.visualFacing - player.facing)).toBeCloseTo(0)
  })
  it('跑步直接出普攻時，骨盆不瞬間跳高 12 公分', async () => {
    const { model, player } = await fresh()
    for (let f = 0; f < 80; f++) {
      player.update(step, { ...idle, moveX: 1 }, () => null, arena); model.update(player, step, f * step)
    }
    const before = model.animationStatus.hipsHeight
    player.update(step, { ...idle, attack: true }, () => null, arena); model.update(player, step, 81 * step)
    expect(Math.abs(model.animationStatus.hipsHeight - before)).toBeLessThan(.05)
  })
})
