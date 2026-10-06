import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Bone, Object3D, Quaternion, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Arena } from '../../src/entities/arena.ts'
import { MUSOU_MAX, Player, type PlayerControls } from '../../src/entities/player.ts'
import { PlayerModel } from '../../src/view/player-model.ts'
import { ZhaoYunSkin, ZHAOYUN_ASSET } from '../../src/view/zhaoyun-adapter.ts'
import { PLAY_LIMIT, PLAYER_START, obstacles } from '../../src/world/layout.ts'

// E06 reference data: the unmodified Web Player, PlayerModel (procedural pose + IK driver rig) and ZhaoYunSkin (bone
// binding on the user's GLB) stepped frame by frame along the plan's route. The GLB is parsed with its embedded
// textures removed (Node has no image decoder); nodes, skin and geometry are untouched.

export const RIG_PARITY_SOURCES = [
  'src/view/player-model.ts', 'src/view/player-poses.ts', 'src/view/zhaoyun-adapter.ts', 'src/view/weapon-grip.ts', 'src/core/ik.ts',
  'src/core/math.ts', 'src/entities/player.ts', 'src/combat/moves.ts', 'public/models/zhaoyun.glb', 'scripts/lib/rig-parity.ts',
] as const

type Button = 'attack' | 'charge' | 'jump' | 'dodge' | 'musou'
type Op = ['hit', number, boolean, number, number] | ['gain', number]
interface Hold { from: number; to: number; move?: [number, number]; guard?: boolean }
interface RigScenario { id: string; duration: number; holds: Hold[]; presses: [number, Button][]; ops: [number, Op][] }

const S = PLAYER_START
const front: [number, number] = [S.x, S.z - 2]
const taps = (button: Button, ...at: number[]): [number, Button][] => at.map((t) => [t, button])

export const RIG_SCENARIOS: RigScenario[] = [
  { id: 'run_stop_turn', duration: 3.0, holds: [{ from: 0, to: 1.2, move: [0, -1] }, { from: 1.7, to: 2.5, move: [0, 1] }], presses: [], ops: [] },
  { id: 'normal_string', duration: 2.6, holds: [], presses: taps('attack', 0, 0.25, 0.5, 0.75, 1.05, 1.35), ops: [] },
  { id: 'charge_c1_c2', duration: 2.2, holds: [], presses: [[0, 'charge'], [0.9, 'attack'], [1.15, 'charge']], ops: [] },
  { id: 'charge_c3', duration: 2.0, holds: [], presses: [...taps('attack', 0, 0.25), [0.5, 'charge']], ops: [] },
  { id: 'charge_c4', duration: 2.2, holds: [], presses: [...taps('attack', 0, 0.25, 0.5), [0.75, 'charge']], ops: [] },
  { id: 'charge_c5', duration: 2.8, holds: [], presses: [...taps('attack', 0, 0.25, 0.5, 0.75), [1.1, 'charge']], ops: [] },
  { id: 'charge_c6', duration: 3.6, holds: [], presses: [...taps('attack', 0, 0.3, 0.55, 0.85, 1.2), [1.6, 'charge']], ops: [] },
  { id: 'jump_land', duration: 3.0, holds: [], presses: [[0, 'jump'], [1.0, 'jump'], [1.25, 'attack'], [2.0, 'jump'], [2.25, 'charge']], ops: [] },
  { id: 'dodge_dash', duration: 1.8, holds: [{ from: 0, to: 0.1, move: [1, 0] }], presses: [[0, 'dodge'], [0.8, 'dodge'], [0.95, 'attack']], ops: [] },
  { id: 'guard_counter', duration: 1.3, holds: [{ from: 0, to: 0.6, guard: true }], presses: [[0.2, 'attack']], ops: [[0.05, ['hit', 20, false, ...front]]] },
  { id: 'hurt_down', duration: 2.6, holds: [], presses: [], ops: [[0.1, ['hit', 20, false, ...front]], [0.8, ['hit', 30, true, ...front]]] },
  { id: 'musou', duration: 4.0, holds: [], presses: [[0.05, 'musou']], ops: [[0, ['gain', MUSOU_MAX]]] },
]

export const RIG_RATES = [30, 60, 120] as const
// Nodes recorded in full at 60 Hz (world position + quaternion); KEY_NODES at every rate.
export const FULL_NODES = ['root', 'hips', 'torso', 'head', 'spear', 'handL', 'handR', 'footL', 'footR', 'upperL', 'upperR', 'cape0', 'cape3'] as const
export const KEY_NODES = ['hips', 'spear', 'handL', 'handR', 'footL', 'footR'] as const
// Bones placed by ZhaoYunSkin, plus the spear mesh node.
export const BONES = ['pelvis', 'spine_03', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'thigh_l', 'calf_l', 'foot_l',
  'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_r', 'calf_r', 'foot_r', 'cape_01', 'cape_02', ZHAOYUN_ASSET.weapon] as const
export const BONE_EVERY = 4
export const SAMPLE_EVERY: Record<number, number> = { 30: 1, 60: 1, 120: 2 }

const frameOf = (t: number, hz: number) => Math.max(0, Math.ceil(t * hz - 1e-9))
const r6 = (v: number) => { const x = Math.round(v * 1e6) / 1e6; return Object.is(x, -0) ? 0 : x }

// The texture-free GLB: identical JSON except images, textures, samplers and material texture slots.
export function textureFreeGlb(glb: Buffer): ArrayBuffer {
  const jsonLength = glb.readUInt32LE(12)
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'))
  delete json.images
  delete json.textures
  delete json.samplers
  for (const m of json.materials ?? []) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture
      delete m.pbrMetallicRoughness.metallicRoughnessTexture
    }
    delete m.normalTexture
    delete m.occlusionTexture
    delete m.emissiveTexture
  }
  let text = JSON.stringify(json)
  while (Buffer.byteLength(text) % 4) text += ' '
  const jsonChunk = Buffer.from(text)
  const rest = glb.subarray(20 + jsonLength)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + jsonChunk.length + rest.length, 8)
  header.writeUInt32LE(jsonChunk.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  const out = Buffer.concat([header, jsonChunk, rest])
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length) as ArrayBuffer
}

interface Rig {
  model: PlayerModel
  nodes: Record<string, Object3D>
  bones: Record<string, Object3D>
  skin: ZhaoYunSkin
}

async function createRig(glb: ArrayBuffer): Promise<Rig> {
  const quiet = console.error
  console.error = () => {} // PlayerModel's own GLB load needs Vite's BASE_URL and fails here; the skin is built below
  let model: PlayerModel
  try {
    model = new PlayerModel()
    await new Promise((resolve) => setTimeout(resolve, 0))
  } finally {
    console.error = quiet
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = model as any
  const nodes: Record<string, Object3D> = {
    root: m.root, hips: m.hips, torso: m.torso, head: m.head, spear: m.spear, handL: m.handAnchorL, handR: m.handAnchorR,
    footL: m.footAnchorL, footR: m.footAnchorR, upperL: m.upperL, upperR: m.upperR, cape0: m.cape[0], cape3: m.cape[3],
  }
  const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => new GLTFLoader().parse(glb, '', resolve as never, reject))
  const skin = new ZhaoYunSkin(gltf.scene as never, {
    hips: m.hips, torso: m.torso, head: m.head, upperL: m.upperL, upperR: m.upperR, foreL: m.foreL, foreR: m.foreR,
    thighL: m.thighL, thighR: m.thighR, kneeL: m.kneeL, kneeR: m.kneeR, handL: m.handAnchorL, handR: m.handAnchorR, spear: m.spear,
    footL: m.footAnchorL, footR: m.footAnchorR, capeTop: m.cape[0], capeLower: m.cape[2],
  })
  // Same wiring as ZhaoYunAdapter.load: the GLB scene under the model group, the spear mesh under the spear driver.
  model.group.add(gltf.scene)
  m.spear.add(skin.weapon)
  const bones: Record<string, Object3D> = {}
  for (const name of BONES) {
    const b = name === ZHAOYUN_ASSET.weapon ? skin.weapon : gltf.scene.getObjectByName(name)
    if (!b || (name !== ZHAOYUN_ASSET.weapon && !(b instanceof Bone))) throw new Error(`missing ${name}`)
    bones[name] = b
  }
  return { model, nodes, bones, skin }
}

const p = new Vector3()
const q = new Quaternion()
const s = new Vector3()
function nodeRecord(o: Object3D): number[] {
  o.updateWorldMatrix(true, false)
  o.matrixWorld.decompose(p, q, s)
  return [p.x, p.y, p.z, q.x, q.y, q.z, q.w].map(r6)
}
function boneRecord(o: Object3D): number[] {
  o.updateWorldMatrix(true, false)
  o.matrixWorld.decompose(p, q, s)
  return [p.x, p.y, p.z, q.x, q.y, q.z, q.w, s.x, s.y, s.z].map(r6)
}

function controlsAt(s: RigScenario, frame: number, hz: number): PlayerControls {
  const c: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
  for (const h of s.holds) {
    if (frameOf(h.from, hz) <= frame && frame < frameOf(h.to, hz)) {
      if (h.move) [c.moveX, c.moveZ] = h.move
      if (h.guard) c.guard = true
    }
  }
  for (const [at, button] of s.presses) if (frameOf(at, hz) === frame) c[button] = true
  return c
}

export async function runRigScenario(s: RigScenario, hz: number, glb: ArrayBuffer) {
  const dt = 1 / hz
  const rig = await createRig(glb)
  const player = new Player()
  const arena = new Arena(PLAY_LIMIT, obstacles())
  player.reset(S.x, S.z, S.facing)
  rig.model.resetCape()
  const full = hz === 60
  const every = SAMPLE_EVERY[hz]
  const frames = []
  const started: string[] = []
  for (let frame = 0; frame < Math.round(s.duration * hz); frame++) {
    for (const [at, op] of s.ops) {
      if (frameOf(at, hz) !== frame) continue
      if (op[0] === 'hit') player.takeHit(op[1], op[2], op[3], op[4])
      else player.gainMusou(op[1])
    }
    const c = controlsAt(s, frame, hz)
    player.update(dt, c, () => null, arena)
    for (const e of player.events) if (e.type === 'moveStart') started.push(e.moveId)
    // Game.updateVisuals: the model follows game time; the cape's wind uses the clock (here the same game time).
    rig.model.update(player, dt, (frame + 1) * dt)
    rig.skin.update((rig.model as unknown as { pose: { lh: number } }).pose.lh)
    if (frame % every !== 0) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = rig.model as any
    const status = rig.model.animationStatus
    const record: Record<string, unknown> = {
      f: frame,
      st: [player.state, player.move?.id ?? '', r6(player.pos.x), r6(player.pos.y), r6(player.pos.z)],
      c: [c.moveX, c.moveZ, c.attack, c.charge, c.jump, c.dodge, c.musou, c.guard === true].map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
      pose: ['lean', 'twist', 'crouch', 'spin', 'flip', 'gx', 'gy', 'gz', 'yaw', 'pitch', 'roll', 'stance', 'lh'].map((k) => r6(m.pose[k])),
      v: [m.visualFacing, m.fade, m.runBlend, status.rightGripError, status.leftGripError].map(r6),
      tip: [...rig.model.tip.toArray(), ...rig.model.tipBase.toArray()].map(r6),
      n: Object.fromEntries((full ? FULL_NODES : KEY_NODES).map((name) => [name, nodeRecord(rig.nodes[name])])),
    }
    if (full && frame % BONE_EVERY === 0) record.b = Object.fromEntries(BONES.map((name) => [name, boneRecord(rig.bones[name])]))
    frames.push(record)
  }
  return { id: s.id, hz, duration: s.duration, holds: s.holds, presses: s.presses, ops: s.ops, frames, started }
}

// Bind pose of the GLB's nodes as the loader builds them, for the C# bone tree.
export function glbNodes(glb: Buffer) {
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'))
  return {
    scene: json.scenes[json.scene ?? 0].nodes,
    nodes: json.nodes.map((n: { name: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }) => ({
      name: n.name, children: n.children ?? [], t: n.translation ?? [0, 0, 0], r: n.rotation ?? [0, 0, 0, 1], s: n.scale ?? [1, 1, 1], m: n.matrix ?? null,
    })),
  }
}

export async function buildRigFixture(root: URL) {
  const glbBytes = readFileSync(new URL('public/models/zhaoyun.glb', root))
  const glb = textureFreeGlb(glbBytes)
  const sources = Object.fromEntries(RIG_PARITY_SOURCES.map((file) => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]))
  const scenarios = []
  for (const s of RIG_SCENARIOS) for (const hz of RIG_RATES) scenarios.push(await runRigScenario(s, hz, glb))
  return {
    schemaVersion: 1,
    note: 'Generated by scripts/combat-parity.mjs from the Web source. Do not edit by hand.',
    sources,
    poseFields: ['lean', 'twist', 'crouch', 'spin', 'flip', 'gx', 'gy', 'gz', 'yaw', 'pitch', 'roll', 'stance', 'lh'],
    valueFields: ['visualFacing', 'fade', 'runBlend', 'rightGripError', 'leftGripError'],
    nodeFields: ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw'],
    boneFields: ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'sx', 'sy', 'sz'],
    fullNodes: FULL_NODES, keyNodes: KEY_NODES, bones: BONES, boneEvery: BONE_EVERY, sampleEvery: SAMPLE_EVERY,
    rounding: 1e-6,
    glb: glbNodes(glbBytes),
    scenarios,
  }
}
