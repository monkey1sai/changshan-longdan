import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAMERA_RATES, CAMERA_SCENARIOS, buildCameraFixture } from '../scripts/lib/camera-parity.ts'

const root = new URL('../', import.meta.url)
const committed = readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-camera.json', root), 'utf8')

type Frame = { f: number; pos: number[]; focus: number[]; st: number[]; roofs: number[]; fov: number }
interface Scenario { id: string; hz: number; frames: Frame[] }

describe('Web-to-Unity camera parity fixture', () => {
  const text = `${JSON.stringify(buildCameraFixture(root))}\n`
  const fresh = JSON.parse(text) as { scenarios: Scenario[]; clearance: number[][]; overhang: number[][]; cutaway: number[][]; controls: number[][] }
  const byId = Object.fromEntries(fresh.scenarios.filter((s) => s.hz === 60).map((s) => [s.id, s]))
  const last = (s: Scenario) => s.frames[s.frames.length - 1]

  it('matches the committed fixture byte for byte after regeneration', () => {
    expect(committed === text, 'web-camera.json is stale; run npm run parity:write').toBe(true)
  })

  // Guards the E09 acceptance set: the obstruction, eave, orbit and cutaway behaviours must stay in the data.
  it('keeps every scenario at every rate and reaches the obstruction and cutaway cases', () => {
    for (const hz of CAMERA_RATES) expect(fresh.scenarios.filter((s) => s.hz === hz).map((s) => s.id), `${hz} Hz`).toEqual(CAMERA_SCENARIOS.map((s) => s.id))
    // The title blend has decayed by the end of the long scenarios, so clearance was in effect.
    for (const id of ['south_wall', 'east_wall', 'barracks_eave', 'barracks_side']) expect(last(byId[id]).st[3], id).toBeLessThan(0.001)
    expect(last(byId.south_wall).pos[2]).toBeLessThan(56)
    expect(last(byId.east_wall).pos[0]).toBeLessThan(56)
    expect(last(byId.barracks_eave).pos[2], 'camera stays outside the eave').toBeLessThan(12.5)
    expect(Math.abs(last(byId.barracks_side).pos[0]), 'camera stays outside the barracks').toBeLessThan(38.5)
    // Zoom pulses net to zero, so the boom returns to 9.2 m horizontally once the recenter and the shake have settled.
    const end = last(byId.open_turn_zoom)
    expect(Math.hypot(end.pos[0] - end.focus[0], end.pos[2] - end.focus[2])).toBeCloseTo(9.2, 1)
    // Walking under the eave hides that roof and shows it again after leaving; the camera never enters the building.
    const walk = byId.walk_through_barracks
    expect(walk.frames.some((f) => f.roofs[1] === 0)).toBe(true)
    expect(last(walk).roofs.every((v) => v === 1)).toBe(true)
    expect(Math.max(...walk.frames.filter((f) => f.st[3] < 0.001).map((f) => f.pos[0]))).toBeLessThan(40)
    // Musou lifts and orbits; the title orbit sits far outside the castle.
    expect(Math.max(...byId.musou_orbit.frames.map((f) => f.st[2]))).toBeGreaterThan(0.9)
    expect(Math.max(...byId.musou_orbit.frames.map((f) => f.fov))).toBeGreaterThan(59)
    expect(Math.max(...byId.title_to_battle.frames.map((f) => Math.hypot(f.pos[0], f.pos[2])))).toBeGreaterThan(70)
    // Shake moved the camera off the smooth path on the trauma frame and decayed afterwards.
    expect(Math.max(...byId.open_turn_zoom.frames.map((f) => f.st[0]))).toBeGreaterThan(0.5)
    expect(last(byId.open_turn_zoom).st[0]).toBe(0)
    // Samples cover blocked and open booms, pushed-out points and the cutaway hysteresis.
    expect(fresh.clearance.some((c) => c[4] === 1) && fresh.clearance.some((c) => c[4] === 0) && fresh.clearance.some((c) => c[4] > 0 && c[4] < 1)).toBe(true)
    expect(fresh.overhang.some((o) => o[0] !== o[2] || o[1] !== o[3]) && fresh.overhang.some((o) => o[0] === o[2] && o[1] === o[3])).toBe(true)
    expect(fresh.cutaway.map((c) => c[4])).toEqual([1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1])
    expect(fresh.controls.length).toBe(25)
  })
})
