import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import type { InputFrame } from '../../src/core/input.ts'
import type { PlayerControls } from '../../src/entities/player.ts'
import { cameraClearance, clearCameraOverhang } from '../../src/view/camera-clearance.ts'
import { CameraRig, toPlayerControls } from '../../src/view/camera-rig.ts'
import { updateRoofCutaway } from '../../src/view/roof-cutaway.ts'
import { BARRACKS, BARRACKS_ROOF_OVERHANG, PLAYER_START, PLAY_LIMIT } from '../../src/world/layout.ts'

// E09 reference data (the Web rig starts with its title blend at 1, which decays at 2.2/s, so clearance only engages
// after about 3.2 s: the obstruction scenarios run long enough to pass that, like the Web's 360-frame tests): the unmodified Web camera rig (follow, turn, zoom, recenter, musou orbit, title orbit, clearance,
// eave push-out, shake and kick, fov), the clearance and roof-cutaway helpers and the camera-relative control mapping,
// driven by scripted inputs and target paths, recorded frame by frame.

export const CAMERA_PARITY_SOURCES = [
  'src/view/camera-rig.ts', 'src/view/camera-clearance.ts', 'src/view/roof-cutaway.ts', 'src/world/layout.ts', 'src/core/math.ts',
  'scripts/lib/camera-parity.ts',
] as const

export const CAMERA_RATES = [30, 60, 120] as const
export const ASPECT = 16 / 9

type Key = { at: number; x: number; y: number; z: number }
interface Scenario {
  id: string
  duration: number
  snapYaw: number
  path: Key[] // target position keyframes (linear between)
  turn?: [number, number, number][] // from, to, value
  zoom?: [number, number][] // at, wheel steps
  recenter?: [number, number][] // at, facing
  trauma?: [number, number][] // at, amount
  kick?: [number, number][] // at, amount
  musou?: [number, number]
  title?: [number, number]
}

const S = PLAYER_START
const still = (x: number, z: number, y = 0): Key[] => [{ at: 0, x, y, z }]

export const CAMERA_SCENARIOS: Scenario[] = [
  { id: 'open_turn_zoom', duration: 4, snapYaw: S.facing, path: still(S.x, S.z), turn: [[0.2, 1.2, 1], [1.5, 2.1, -0.6]], zoom: [[0.5, 1], [0.7, 1], [2.2, -2]],
    recenter: [[2.5, 1.0]], trauma: [[3.0, 0.6]], kick: [[3.2, 0.5]] },
  { id: 'south_wall', duration: 6, snapYaw: Math.PI, path: still(0, 54.55) },
  { id: 'east_wall', duration: 6, snapYaw: -Math.PI / 2, path: still(54.55, 40) },
  { id: 'barracks_eave', duration: 6, snapYaw: Math.PI, path: still(48.5, 13.55) },
  { id: 'barracks_side', duration: 6, snapYaw: -Math.PI / 2, path: still(39.55, 0) },
  { id: 'barracks_corner_yaws', duration: 8, snapYaw: 0, path: still(39.6, 13.6), turn: [[3.5, 7.6, 0.7]] },
  { id: 'walk_through_barracks', duration: 8.5, snapYaw: -Math.PI / 2, path: [{ at: 0, x: 36, y: 0, z: 0 }, { at: 3.5, x: 36, y: 0, z: 0 }, { at: 5.5, x: 46.5, y: 0, z: 0.5 }, { at: 6.5, x: 46.5, y: 0, z: 0.5 }, { at: 8.5, x: 36, y: 0, z: -1 }] },
  { id: 'musou_orbit', duration: 4.5, snapYaw: Math.PI, path: still(0, 20), musou: [0.5, 3.5] },
  { id: 'title_to_battle', duration: 4, snapYaw: Math.PI, path: still(S.x, S.z), title: [0, 2] },
  { id: 'jump_focus', duration: 2.5, snapYaw: Math.PI, path: [{ at: 0, x: 0, y: 0, z: 30 }, { at: 0.3, x: 0, y: 0, z: 30 }, { at: 0.6, x: 0, y: 1.8, z: 29 }, { at: 0.9, x: 0, y: 0, z: 28 }, { at: 2.5, x: 0, y: 0, z: 25 }] },
]

const r = (v: number) => (Object.is(v, -0) ? 0 : v)
const priv = (rig: CameraRig) => rig as unknown as { trauma: number; punch: number; musou: number; title: number; zoomedDistance: number; recenterYaw: number | null }

function at(path: Key[], t: number, out: Vector3): Vector3 {
  if (t <= path[0].at) return out.set(path[0].x, path[0].y, path[0].z)
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].at) {
      const a = path[i - 1], b = path[i]
      const k = (t - a.at) / (b.at - a.at)
      return out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k)
    }
  }
  const last = path[path.length - 1]
  return out.set(last.x, last.y, last.z)
}
const frameOf = (t: number, hz: number) => Math.max(0, Math.ceil(t * hz - 1e-9))

export function runCameraScenario(s: Scenario, hz: number) {
  const dt = 1 / hz
  const rig = new CameraRig(ASPECT)
  const target = new Vector3()
  at(s.path, 0, target)
  rig.snap(target, s.snapYaw)
  const roofs = BARRACKS.map(() => ({ visible: true }))
  const p = priv(rig)
  const frames = []
  for (let frame = 0; frame < Math.round(s.duration * hz); frame++) {
    const t = frame * dt
    at(s.path, t, target)
    let turn = 0
    for (const [from, to, value] of s.turn ?? []) if (t + 1e-9 >= from && t + 1e-9 < to) turn = value
    let zoom = 0
    for (const [when, steps] of s.zoom ?? []) if (frameOf(when, hz) === frame) zoom += steps
    for (const [when, facing] of s.recenter ?? []) if (frameOf(when, hz) === frame) rig.recenter(facing)
    for (const [when, amount] of s.trauma ?? []) if (frameOf(when, hz) === frame) rig.addTrauma(amount)
    for (const [when, amount] of s.kick ?? []) if (frameOf(when, hz) === frame) rig.kick(amount)
    const musou = s.musou !== undefined && t + 1e-9 >= s.musou[0] && t + 1e-9 < s.musou[1]
    const title = s.title !== undefined && t + 1e-9 >= s.title[0] && t + 1e-9 < s.title[1]
    const wasTitle = s.title !== undefined && frame > 0 && (frame - 1) * dt + 1e-9 >= s.title[0] && (frame - 1) * dt + 1e-9 < s.title[1]
    if (wasTitle && !title) rig.snap(target, s.snapYaw) // game.ts startBattle snaps the rig
    rig.update(dt, target, turn, zoom, musou, title, t)
    updateRoofCutaway(roofs, target.x, target.z, title)
    const c = rig.camera
    frames.push({
      f: frame,
      in: [r(target.x), r(target.y), r(target.z), turn, zoom, musou ? 1 : 0, title ? 1 : 0],
      yaw: r(rig.yaw), distance: rig.distance,
      focus: [r(rig.focus.x), r(rig.focus.y), r(rig.focus.z)],
      fwd: [r(rig.forward.x), r(rig.forward.z)], right: [r(rig.right.x), r(rig.right.z)],
      pos: [r(c.position.x), r(c.position.y), r(c.position.z)],
      q: [r(c.quaternion.x), r(c.quaternion.y), r(c.quaternion.z), r(c.quaternion.w)],
      up: [r(c.up.x), r(c.up.y), r(c.up.z)],
      fov: c.fov,
      st: [p.trauma, p.punch, r(p.musou), r(p.title), p.zoomedDistance, p.recenterYaw === null ? -99 : p.recenterYaw, rig.focusDistance],
      roofs: roofs.map((roof) => (roof.visible ? 1 : 0)),
    })
  }
  return { id: s.id, hz, duration: s.duration, snapYaw: s.snapYaw, frames }
}

export function buildCameraFixture(root: URL) {
  const sources = Object.fromEntries(CAMERA_PARITY_SOURCES.map((file) => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]))
  // Clearance samples: focus and desired camera pairs across open ground, walls, barracks, the keep and the edge.
  const pairs: [number, number, number, number][] = [
    [0, 42, 0, 51.2], [0, 42, 0, 60], [38.9, 0, 48.1, 0], [39.55, 0, 48.75, 0], [-39.55, 0, -48.75, 0], [0, 54.55, 0, 63.75], [54.55, 40, 63.75, 40],
    [0, -28, 0, -37.2], [0, -24, 0, -14.8], [10, 40, 8.3, 40.7], [-8.5, 26.2, -8.5, 35.4], [46.5, 0, 46.5, 9.2], [46.5, 0, 55.7, 0], [30, 44, 30, 53.2],
    [48.5, 13.55, 48.5, 22.75], [39.6, 13.6, 48.8, 13.6], [39.6, 13.6, 39.6, 22.8], [39.6, 13.6, 33.1, 20.1],
  ]
  const clearance = pairs.map(([fx, fz, cx, cz]) => [fx, fz, cx, cz, cameraClearance(fx, fz, cx, cz)])
  const overhangPoints: [number, number][] = [[46.5, 0], [41, -7.3], [52.5, 8.2], [39.2, 13.6], [-41, 20], [46.5, 30], [0, 42], [38.4, 0]]
  const overhang = overhangPoints.map(([x, z]) => {
    const p = { x, z }
    clearCameraOverhang(p)
    return [x, z, r(p.x), r(p.z)]
  })
  // The roof-cutaway test sequence plus the eave edge for every barracks.
  const edge = BARRACKS[1].minX - BARRACKS_ROOF_OVERHANG
  const cutawayInputs: [number, number, number][] = [
    [edge - 0.61, 0, 0], [edge - 0.8, 0, 0], [edge - 0.59, 0, 0], [edge - 0.8, 0, 0], [edge - 1.01, 0, 0], [39.55, 0, 0], [39.55, 0, 1], [39.55, 0, 0], [0, 42, 0],
    ...BARRACKS.map((b): [number, number, number] => [(b.minX + b.maxX) / 2, b.minZ - 0.45, 0]),
  ]
  const roofs = BARRACKS.map(() => ({ visible: true }))
  const cutaway = cutawayInputs.map(([x, z, title]) => {
    updateRoofCutaway(roofs, x, z, title === 1)
    return [x, z, title, ...roofs.map((roof) => (roof.visible ? 1 : 0))]
  })
  // Control mapping samples at a few camera yaws.
  const base: InputFrame = { moveX: 0, moveY: 0, camTurn: 0, zoom: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, pause: false, confirm: false, debug: false }
  const controls = [] as number[][]
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
    const rig = new CameraRig(ASPECT)
    rig.snap(new Vector3(), yaw)
    for (const [mx, my] of [[0, 1], [1, 0], [1, 1], [0.3, 0], [-0.6, 0.8]]) {
      const out: PlayerControls = { moveX: 9, moveZ: 9, attack: true, charge: true, jump: true, dodge: true, musou: true, guard: true }
      toPlayerControls({ ...base, moveX: mx, moveY: my, attack: mx === 1, guard: my === 1 }, rig.forward, rig.right, out)
      controls.push([yaw, mx, my, r(out.moveX), r(out.moveZ), out.attack ? 1 : 0, out.guard ? 1 : 0])
    }
  }
  return {
    schemaVersion: 1,
    note: 'Generated by scripts/combat-parity.mjs from the Web source. Do not edit by hand.',
    sources,
    constants: { aspect: ASPECT, playLimit: PLAY_LIMIT, roofOverhang: BARRACKS_ROOF_OVERHANG, barracks: BARRACKS.map((b) => [b.minX, b.maxX, b.minZ, b.maxZ]) },
    frameFields: 'in=[x,y,z,turn,zoom,musou,title]; st=[trauma,punch,musou,title,zoomedDistance,recenterYaw(-99=none),focusDistance]',
    clearance, overhang, cutaway, controls,
    scenarios: CAMERA_SCENARIOS.flatMap((s) => CAMERA_RATES.map((hz) => runCameraScenario(s, hz))),
  }
}
