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

  it('閃避的動作期按普攻會接出 DASH', () => {
    const p = fresh()
    const moves = play(p, 30, (f) => ({ dodge: f === 0, attack: f === 8, moveX: 1 }))
    expect(moves).toEqual(['DASH'])
  })

  it('正面完美格擋不扣血、充能並可接 COUNTER', () => {
    const p = fresh()
    p.update(STEP, { ...idle, guard: true }, noAim, arena)
    expect(p.state).toBe('guard')
    expect(p.takeHit(80, true, 0, 2)).toBe(false)
    expect(p.hp).toBe(p.maxHp)
    expect(p.musou).toBe(12)
    expect(p.counterReady).toBeGreaterThan(0)
    const moves = play(p, 2, (f) => ({ guard: true, attack: f === 0 }))
    expect(moves).toEqual(['COUNTER'])
  })

  it('完美格擋後放開防禦仍可在反擊窗口按攻擊', () => {
    const p = fresh()
    p.update(STEP, { ...idle, guard: true }, noAim, arena)
    expect(p.takeHit(80, false, 0, 2)).toBe(false)
    const moves = play(p, 2, (f) => ({ guard: false, attack: f === 0 }))
    expect(moves).toEqual(['COUNTER'])
  })

  it('防禦可原地轉向，且持續按住不會重開完美格擋窗口', () => {
    const p = fresh()
    play(p, 30, () => ({ guard: true, moveX: 1 }))
    expect(p.facing).toBeCloseTo(Math.PI / 2, 1)
    expect(p.parryTimer).toBe(0)
    expect(p.takeHit(80, false, 2, 0)).toBe(true)
    expect(p.hp).toBe(p.maxHp - 20)
    play(p, 1, () => ({ guard: false }))
    play(p, 1, () => ({ guard: true }))
    expect(p.parryTimer).toBeGreaterThan(0)
  })

  it('無雙就緒時優先於守勢，並可從守勢發動', () => {
    const freshReady = fresh()
    freshReady.musou = MUSOU_MAX
    freshReady.update(STEP, { ...idle, guard: true, musou: true }, noAim, arena)
    expect(freshReady.state).toBe('musou')

    const guarding = fresh()
    guarding.update(STEP, { ...idle, guard: true }, noAim, arena)
    guarding.musou = MUSOU_MAX
    guarding.update(STEP, { ...idle, guard: true, musou: true }, noAim, arena)
    expect(guarding.state).toBe('musou')
  })

  it('完美格擋窗口後的正面格擋只受 chip 傷害且不硬直', () => {
    const p = fresh()
    play(p, 12, () => ({ guard: true }))
    expect(p.parryTimer).toBe(0)
    expect(p.takeHit(80, false, 0, 2)).toBe(true)
    expect(p.hp).toBe(p.maxHp - 20)
    expect(p.state).toBe('guard')
  })

  it('背後攻擊與空中時不能錯誤格擋', () => {
    const rear = fresh()
    rear.update(STEP, { ...idle, guard: true }, noAim, arena)
    expect(rear.takeHit(60, false, 0, -2)).toBe(true)
    expect(rear.hp).toBe(rear.maxHp - 60)
    expect(rear.state).toBe('hurt')

    const air = fresh()
    air.update(STEP, { ...idle, jump: true }, noAim, arena)
    air.update(STEP, { ...idle, guard: true }, noAim, arena)
    expect(air.state).toBe('jump')
  })

  it('格擋 chip 致死後不會再被守勢或反擊復活', () => {
    const p = fresh()
    p.hp = 40
    play(p, 12, () => ({ guard: true }))
    expect(p.takeHit(100, true, 0, 2)).toBe(true)
    expect(p.state).toBe('dead')
    p.update(STEP, { ...idle, guard: true, attack: true }, noAim, arena)
    expect(p.state).toBe('dead')
    expect(p.move).toBeNull()
  })

  it('未格擋命中與閃避都會清除未使用的反擊權', () => {
    const hurt = fresh()
    hurt.update(STEP, { ...idle, guard: true }, noAim, arena)
    hurt.takeHit(80, false, 0, 2)
    expect(hurt.counterReady).toBeGreaterThan(0)
    expect(hurt.takeHit(40, false, 0, -2)).toBe(true)
    expect(hurt.counterReady).toBe(0)

    const dodge = fresh()
    dodge.update(STEP, { ...idle, guard: true }, noAim, arena)
    dodge.takeHit(80, false, 0, 2)
    dodge.update(STEP, { ...idle, guard: true, dodge: true, moveX: 1 }, noAim, arena)
    expect(dodge.state).toBe('dodge')
    expect(dodge.counterReady).toBe(0)
  })

  it('地面攻擊在最後判定後可用方向輸入取消收招移動', () => {
    const p = fresh()
    play(p, 16, (f) => ({ attack: f === 0, moveX: f >= 14 ? 1 : 0 }))
    expect(p.state).toBe('move')
    expect(p.move).toBeNull()
    play(p, 2, () => ({ moveX: 1 }))
    expect(p.pos.x).toBeGreaterThan(0)
  })

  it('清除緩衝後不會在恢復時誤出招，且蓄力優先於自動普攻', () => {
    const cleared = fresh()
    cleared.queue({ ...idle, attack: true })
    cleared.clearQueuedActions()
    expect(play(cleared, 2, () => ({}))).toEqual([])

    const charged = fresh()
    charged.queue({ ...idle, charge: true })
    charged.queue({ ...idle, attack: true })
    expect(play(charged, 2, () => ({}))).toEqual(['C1'])
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
