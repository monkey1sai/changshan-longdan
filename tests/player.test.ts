import { describe, expect, it } from 'vitest'
import type { MoveId } from '../src/combat/moves.ts'
import { Arena } from '../src/entities/arena.ts'
import { MUSOU_MAX, Player, type PlayerControls } from '../src/entities/player.ts'

const arena = new Arena(200, [])
const noAim = () => null
const idle: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }
const STEP = 1 / 60

function fresh(): Player {
  const p = new Player()
  p.reset(0, 0, 0)
  return p
}

/** 逐幀推進，回傳期間出過的招式。 */
function play(p: Player, frames: number, input: (frame: number) => Partial<PlayerControls>): MoveId[] {
  const moves: MoveId[] = []
  for (let f = 0; f < frames; f++) {
    p.update(STEP, { ...idle, ...input(f) }, noAim, arena)
    for (const e of p.events) if (e.type === 'moveStart') moves.push(e.moveId)
  }
  return moves
}

describe('Player', () => {
  it('連按普攻依序打出 N1 到 N6', () => {
    const moves = play(fresh(), 60 * 5, (f) => ({ attack: f % 6 === 0 }))
    expect(moves.slice(0, 6)).toEqual(['N1', 'N2', 'N3', 'N4', 'N5', 'N6'])
  })

  it('長招一出手就只按一次普攻，也會保留到可接招時接出下一招', () => {
    const p = fresh()
    const moves: MoveId[] = []
    for (let f = 0; f < 600 && !moves.includes('N5'); f++) {
      p.update(STEP, { ...idle, attack: f % 6 === 0 }, noAim, arena)
      for (const e of p.events) if (e.type === 'moveStart') moves.push(e.moveId)
    }
    expect(moves).toContain('N5')
    moves.push(...play(p, 60, (f) => ({ attack: f === 0 })))
    expect(moves).toContain('N6')
  })

  it('N3 之後按蓄力接出 C4', () => {
    const p = fresh()
    const presses: Record<number, Partial<PlayerControls>> = {
      0: { attack: true },
      12: { attack: true },
      24: { attack: true },
      36: { charge: true },
    }
    const moves = play(p, 90, (f) => presses[f] ?? {})
    expect(moves).toEqual(['N1', 'N2', 'N3', 'C4'])
  })

  it('空中按普攻出跳擊，落地瞬間產生衝擊波', () => {
    const p = fresh()
    const kinds: string[] = []
    const moves: MoveId[] = []
    for (let f = 0; f < 90; f++) {
      p.update(STEP, { ...idle, jump: f === 0, attack: f === 10 }, noAim, arena)
      for (const e of p.events) {
        kinds.push(e.type)
        if (e.type === 'moveStart') moves.push(e.moveId)
      }
    }
    expect(moves).toEqual(['JA'])
    expect(kinds).toContain('fx')
    expect(kinds).toContain('land')
    expect(p.pos.y).toBe(0)
  })

  it('閃避時是無敵的', () => {
    const p = fresh()
    p.update(STEP, { ...idle, dodge: true, moveX: 1 }, noAim, arena)
    expect(p.state).toBe('dodge')
    expect(p.takeHit(50, false, 1, 0)).toBe(false)
    expect(p.hp).toBe(p.maxHp)
  })

  it('無雙需要氣滿；發動後整段無敵，結束後回到自由狀態', () => {
    const p = fresh()
    p.update(STEP, { ...idle, musou: true }, noAim, arena)
    expect(p.state).toBe('move')
    p.musou = MUSOU_MAX
    p.update(STEP, { ...idle, musou: true }, noAim, arena)
    expect(p.state).toBe('musou')
    expect(p.musou).toBe(0)
    expect(p.takeHit(70, true, 1, 0)).toBe(false)
    play(p, 60 * 4, () => ({}))
    expect(p.state).toBe('move')
  })

  it('被隊長重擊會倒地並扣血', () => {
    const p = fresh()
    expect(p.takeHit(70, true, 0, 2)).toBe(true)
    expect(p.state).toBe('down')
    expect(p.hp).toBe(p.maxHp - 70)
  })

  it('命中停頓期間按的鍵會保留到下一次更新', () => {
    const p = fresh()
    p.queue({ ...idle, attack: true })
    const moves = play(p, 2, () => ({}))
    expect(moves).toEqual(['N1'])
  })
})
