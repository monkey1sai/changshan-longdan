import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Arena } from '../src/entities/arena.ts'
import { Battle } from '../src/entities/battle.ts'
import { Kind } from '../src/entities/enemies.ts'
import type { PlayerControls } from '../src/entities/player.ts'
import { PLAY_LIMIT, PLAYER_START, obstacles } from '../src/world/layout.ts'
import { REACTION_RATES, REACTION_SCENARIOS, buildReactionFixture } from '../scripts/lib/reaction-parity.ts'

const root = new URL('../', import.meta.url)
const committed = readFileSync(new URL('unity/ChangshanLongdan/TestData/combat/web-reactions.json', root), 'utf8')

type Frame = { f: number; s: (string | number)[]; hs: number; e?: unknown[][]; n: number[][] }
interface Scenario { id: string; hz: number; duration: number; strikes: { at: number; damage: number; heavy: boolean; x: number; z: number }[]; holds: { from: number; to: number; guard?: boolean }[]; presses: [string, number][]; playerHp: number | null; frames: Frame[] }

const STATE = { idle: 0, flinch: 6, air: 7, knockback: 8, down: 9, getup: 10, dead: 11 } as const

describe('Web-to-Unity reaction parity fixture', () => {
  const text = `${JSON.stringify(buildReactionFixture(root))}\n`
  const fresh = JSON.parse(text) as { scenarios: Scenario[] }
  const at = (hz: number) => fresh.scenarios.filter((s) => s.hz === hz)
  const states = (s: Scenario) => new Set(s.frames.flatMap((f) => f.n.map((n) => n[0])))
  const events = (s: Scenario) => s.frames.flatMap((f) => f.e ?? []).map((e) => e[0] as string)

  it('matches the committed fixture byte for byte after regeneration', () => {
    expect(committed === text, 'web-reactions.json is stale; run npm run parity:write').toBe(true)
  })

  // Guards the E07 acceptance set: regenerating the fixture cannot silently drop a reaction, a cycle or a strike case.
  it('keeps every scenario at every rate and reaches every reaction state', () => {
    for (const hz of REACTION_RATES) expect(at(hz).map((s) => s.id), `${hz} Hz`).toEqual(REACTION_SCENARIOS.map((s) => s.id))
    const reached = new Set(at(60).flatMap((s) => [...states(s)]))
    expect([...reached].sort((a, b) => a - b)).toEqual(Object.values(STATE))
    const byId = Object.fromEntries(at(60).map((s) => [s.id, s]))
    expect(states(byId.launch_juggle_land)).toEqual(new Set([STATE.idle, STATE.air, STATE.down, STATE.getup]))
    expect(states(byId.knockdown_cycles)).toContain(STATE.air) // a launch lifts a downed soldier again
    expect(states(byId.getup_flinch)).toContain(STATE.flinch) // hit while getting up
    expect(events(byId.kill_velocities)).toContain('kill')
    expect(events(byId.musou_crowd).filter((e) => e === 'hit').length).toBeGreaterThan(10)
    expect(events(byId.guard_parry_then_block)).toEqual(['enemyStrike', 'parry', 'enemyStrike', 'guardBlock'])
    expect(events(byId.armor_half_damage)).toEqual(['enemyStrike', 'hurt'])
    expect(byId.armor_half_damage.frames.some((f) => f.s[0] === 'down' || f.s[0] === 'hurt'), 'armor must not stagger').toBe(false)
    expect(byId.death.frames.at(-1)?.s[0]).toBe('dead')
    expect(byId.hurt_heavy_down_invuln.frames.filter((f) => f.e).length, 'strikes during invulnerability are ignored but still recorded').toBe(3)
  })

  // The strike part of the harness mirrors Battle.resolveStrike by hand; the real Battle must agree on the player's
  // state, health, musou and the strike events frame by frame (soldiers far away, so the AI never reaches the player).
  it('agrees with the real Battle on the hurt loop', () => {
    const S = PLAYER_START
    for (const s of fresh.scenarios.filter((x) => x.strikes.length > 0)) {
      const dt = 1 / s.hz
      const battle = new Battle({
        arena: new Arena(PLAY_LIMIT, obstacles()),
        spawns: () => [{ x: 60, z: 60, yaw: 0, kind: Kind.Captain }],
        playerStart: { x: S.x, z: S.z, facing: S.facing },
        capacity: 1,
      })
      if (s.playerHp !== null) battle.debug.setHp(s.playerHp)
      let next = 0
      let started = 0
      const frames = Math.round(s.duration * s.hz)
      const recorded = new Map(s.frames.map((f) => [f.f, f]))
      for (let frame = 0; frame < frames; frame++) {
        const t = frame * dt
        const c: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
        for (const h of s.holds) if (t + 1e-9 >= h.from && t + 1e-9 < h.to && h.guard) c.guard = true
        if (next < s.presses.length) {
          const [button, after] = s.presses[next]
          if (next === 0 || (started >= next && battle.hitstop <= 0 && battle.player.moveTime >= after)) {
            c[button as 'attack' | 'charge'] = true
            next++
          }
        }
        battle.step(dt, c)
        started += battle.events.filter((e) => e.type === 'moveStart').length
        const types: string[] = []
        for (const st of s.strikes) {
          if (Math.max(0, Math.ceil(st.at * s.hz - 1e-9)) !== frame) continue
          battle.debug.injectStrike({ damage: st.damage, heavy: st.heavy, x: st.x, z: st.z })
          // Combo and battle outcome (defeat/victory, slow motion) are not part of E07.
          types.push(...battle.events.filter((e) => e.type !== 'comboBreak' && e.type !== 'defeat' && e.type !== 'victory').map((e) => e.type))
        }
        const f = recorded.get(frame)
        if (f === undefined) continue
        const p = battle.player
        const id = `${s.id}@${s.hz} f${frame}`
        expect([p.state, p.move?.id ?? ''], id).toEqual([f.s[0], f.s[1]])
        for (const [k, v] of [[3, p.pos.x], [5, p.pos.z], [6, p.facing], [7, p.musou], [8, p.hp]] as const) expect(v, `${id} field ${k}`).toBeCloseTo(f.s[k] as number, 5)
        if (types.length > 0) expect(types, id).toEqual((f.e ?? []).map((e) => e[0]))
      }
    }
  })
})
