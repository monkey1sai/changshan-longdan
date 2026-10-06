import { describe, expect, it } from 'vitest'
import { Arena } from '../src/entities/arena.ts'
import { Battle, COMBO_WINDOW, rank, type BattleEvent } from '../src/entities/battle.ts'
import { DIFFICULTIES } from '../src/core/difficulty.ts'
import { Kind, type Spawn } from '../src/entities/enemies.ts'
import { MUSOU_MAX, type PlayerControls } from '../src/entities/player.ts'

const STEP = 1 / 60
const idle: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }
const spear = (x: number, z: number): Spawn => ({ x, z, yaw: Math.PI, kind: Kind.Spear })
/** 隊長血量 230，damageAll(60) 打不死；放在交戰距離外當作「戰場上還有人」。 */
const farCaptain = (i = 0): Spawn => ({ x: 60 + i * 2, z: 60, yaw: 0, kind: Kind.Captain })

/** 玩家站在原點面向 +z 的小戰場。 */
function battle(spawns: Spawn[]): Battle {
  return new Battle({
    arena: new Arena(100, []),
    spawns: () => spawns.map((s) => ({ ...s })),
    playerStart: { x: 0, z: 0, facing: 0 },
    capacity: spawns.length,
  })
}

type EventOf<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>

/** 逐幀推進直到出現指定事件，回傳該事件。 */
function stepUntil<T extends BattleEvent['type']>(b: Battle, type: T, input: (frame: number) => Partial<PlayerControls> = () => ({}), frames = 120): EventOf<T> {
  for (let f = 0; f < frames; f++) {
    b.step(STEP, { ...idle, ...input(f) })
    const e = b.events.find((x): x is EventOf<T> => x.type === type)
    if (e !== undefined) return e
  }
  throw new Error(`${frames} 幀內沒有出現 ${type}`)
}

/** 推進指定秒數，回傳期間所有事件的種類。 */
function stepFor(b: Battle, seconds: number, input: Partial<PlayerControls> = {}): BattleEvent['type'][] {
  const types: BattleEvent['type'][] = []
  for (let t = 0; t < seconds; t += STEP) {
    b.step(STEP, { ...idle, ...input })
    for (const e of b.events) types.push(e.type)
  }
  return types
}

/** 普攻打中正前方的士兵，回傳命中事件。 */
function landHit(b: Battle): EventOf<'hit'> {
  return stepUntil(b, 'hit', (f) => ({ attack: f === 0 }))
}

describe('Battle 命中', () => {
  it('打中敵兵：送出 hit、連擊增加、無雙量增加，下一幀進入命中停頓', () => {
    const b = battle([spear(0, 1.6), farCaptain()])
    const hit = landHit(b)
    expect(hit.count).toBe(1)
    expect(b.hits.slice(hit.start, hit.start + hit.count).map((h) => h.id)).toEqual([0])
    expect(b.combo).toBe(1)
    expect(b.player.musou).toBeCloseTo(1.4)
    expect(b.step(STEP, idle)).toBe(0)
  })

  it('命中停頓期間按下的普攻會在停頓結束後出招', () => {
    const b = battle([spear(0, 1.6), farCaptain()])
    landHit(b)
    expect(b.step(STEP, { ...idle, attack: true })).toBe(0)
    expect(stepUntil(b, 'moveStart').moveId).toBe('N2')
  })

  it('interrupt() 會清掉命中停頓期間存下的動作', () => {
    const b = battle([spear(0, 1.6), farCaptain()])
    landHit(b)
    b.step(STEP, { ...idle, attack: true })
    b.interrupt()
    expect(stepFor(b, 1)).not.toContain('moveStart')
  })
})

describe('Battle 連擊', () => {
  it('超過連擊窗口沒有接上就歸零，不送 comboBreak', () => {
    const b = battle([spear(0, 1.6), farCaptain()])
    landHit(b)
    expect(b.combo).toBe(1)
    const types = stepFor(b, COMBO_WINDOW + 0.2)
    expect(types).not.toContain('hurt')
    expect(types).not.toContain('comboBreak')
    expect(b.combo).toBe(0)
    expect(b.maxCombo).toBe(1)
  })

  it('受傷時連擊中斷並送出 comboBreak', () => {
    const b = battle([spear(0, 1.6), farCaptain()])
    landHit(b)
    b.debug.injectStrike({ damage: 26, heavy: false, x: 0, z: -2 })
    expect(b.events.map((e) => e.type)).toEqual(['enemyStrike', 'comboBreak', 'hurt'])
    expect(b.combo).toBe(0)
  })
})

describe('Battle 擊殺', () => {
  it('擊殺送出 kill 並累計擊殺數；擊殺過半時送出 halfDefeated', () => {
    const b = battle([spear(0, 8), spear(3, 8), farCaptain(0), farCaptain(1)])
    expect(b.debug.damageAll(60)).toBe(4)
    b.step(STEP, idle)
    const kill = b.events.find((e) => e.type === 'kill')
    expect(kill).toMatchObject({ count: 2 })
    expect(b.ko).toBe(2)
    expect(b.events.map((e) => e.type)).toContain('halfDefeated')
    expect(b.outcome).toBe('ongoing')
  })

  it('半數門檻是敵兵總數的一半（無條件進位）', () => {
    const b = battle([spear(0, 8), spear(3, 8), farCaptain(0), farCaptain(1), farCaptain(2)])
    b.debug.damageAll(60)
    b.step(STEP, idle)
    expect(b.ko).toBe(2)
    expect(b.events.map((e) => e.type)).not.toContain('halfDefeated')
  })

  it('每 100 斬送出 milestone', () => {
    const spawns = Array.from({ length: 100 }, (_, i) => spear((i % 10) * 3 - 15, 20 + Math.floor(i / 10) * 3))
    const b = battle([...spawns, farCaptain()])
    b.debug.damageAll(60)
    b.step(STEP, idle)
    expect(b.ko).toBe(100)
    const types = b.events.map((e) => e.type)
    expect(b.events.find((e) => e.type === 'milestone')).toMatchObject({ ko: 100 })
    expect(types).not.toContain('halfDefeated')
  })

  it('最後一名敵兵倒下直接勝利時，不再送 milestone', () => {
    const spawns = Array.from({ length: 100 }, (_, i) => spear((i % 10) * 3 - 15, 20 + Math.floor(i / 10) * 3))
    const b = battle(spawns)
    b.debug.damageAll(60)
    b.step(STEP, idle)
    const types = b.events.map((e) => e.type)
    expect(types).toContain('victory')
    expect(types).not.toContain('milestone')
  })
})

describe('Battle 敵兵出手', () => {
  it('剛起防時完美招架：不扣血、取得反擊窗口並短暫停頓', () => {
    const b = battle([farCaptain()])
    b.step(STEP, { ...idle, guard: true })
    b.debug.injectStrike({ damage: 80, heavy: true, x: 0, z: 2 })
    expect(b.events.map((e) => e.type)).toEqual(['enemyStrike', 'parry'])
    expect(b.events[1]).toMatchObject({ facing: b.player.facing })
    expect(b.player.hp).toBe(b.player.maxHp)
    expect(b.player.counterReady).toBeGreaterThan(0)
    expect(b.step(STEP, { ...idle, guard: true })).toBe(0)
  })

  it('防禦超過招架窗口後只擋下部分傷害', () => {
    const b = battle([farCaptain()])
    stepFor(b, 0.3, { guard: true })
    b.debug.injectStrike({ damage: 40, heavy: false, x: 0, z: 2 })
    expect(b.events.map((e) => e.type)).toEqual(['enemyStrike', 'guardBlock'])
    expect(b.events[1]).toMatchObject({ facing: b.player.facing, heavy: false, damage: 10 })
    expect(b.damageTaken).toBeCloseTo(10)
  })

  it('沒有防禦就受傷並計入受到的傷害', () => {
    const b = battle([farCaptain()])
    b.debug.injectStrike({ damage: 26, heavy: false, x: 0, z: 2 })
    expect(b.events.map((e) => e.type)).toEqual(['enemyStrike', 'hurt'])
    expect(b.damageTaken).toBe(26)
  })

  it('HP 歸零時敗北', () => {
    const b = battle([farCaptain()])
    b.debug.setHp(1)
    b.debug.injectStrike({ damage: 26, heavy: false, x: 0, z: 2 })
    expect(b.events.map((e) => e.type)).toContain('defeat')
    expect(b.outcome).toBe('defeat')
    expect(b.result()).toMatchObject({ win: false, damage: 1 })
  })
})

describe('Battle 勝敗', () => {
  it('敵兵全滅時勝利；之後忽略輸入、戰鬥計時停止、進入慢動作', () => {
    const b = battle([spear(0, 8), spear(3, 8)])
    stepFor(b, 0.5)
    b.debug.damageAll(1000)
    b.step(STEP, idle)
    expect(b.events.map((e) => e.type)).toEqual(expect.arrayContaining(['kill', 'victory']))
    expect(b.outcome).toBe('victory')
    const time = b.battleTime
    expect(b.step(STEP, idle)).toBeCloseTo(STEP * 0.3)
    expect(stepFor(b, 1, { attack: true })).not.toContain('moveStart')
    expect(b.battleTime).toBe(time)
    expect(b.result()).toMatchObject({ win: true, ko: 2, seconds: time })
  })

  it('評價門檻', () => {
    const r = (win: boolean, ko: number, seconds: number, damage: number) => rank({ win, ko, seconds, damage })
    expect(r(true, 300, 299, 399)).toBe('S')
    expect(r(true, 300, 299, 400)).toBe('A')
    expect(r(true, 300, 300, 0)).toBe('A')
    expect(r(true, 300, 479, 0)).toBe('A')
    expect(r(true, 300, 480, 0)).toBe('B')
    expect(r(false, 200, 0, 0)).toBe('B')
    expect(r(false, 199, 0, 0)).toBe('C')
    expect(r(false, 100, 0, 0)).toBe('C')
    expect(r(false, 99, 0, 0)).toBe('D')
  })
})

describe('Battle 無雙', () => {
  it('無雙量剛集滿時只送出一次 musouReady', () => {
    const b = battle([farCaptain()])
    b.debug.setMusou(MUSOU_MAX)
    const types = stepFor(b, 0.5)
    expect(types.filter((t) => t === 'musouReady')).toHaveLength(1)
  })

  it('放出無雙會召喚蒼龍，撞擊敵兵送出 dragonHit', () => {
    const b = battle([spear(0, 4), spear(4, 0), spear(-4, 0), farCaptain()])
    b.debug.setMusou(MUSOU_MAX)
    stepUntil(b, 'musouStart', (f) => ({ musou: f === 0 }))
    expect(b.dragon.active).toBe(true)
    const hit = stepUntil(b, 'dragonHit', () => ({}), 200)
    expect(hit.count).toBeGreaterThan(0)
  })
})

describe('Battle 難度與戰況', () => {
  it('reset 套用難度：修羅的隊長比普通更耐打', () => {
    const b = battle([farCaptain(0), farCaptain(1), spear(0, 8)])
    const lethal = 230 * DIFFICULTIES.normal.captainHp + 1
    b.debug.damageAll(lethal)
    b.step(STEP, idle)
    expect(b.ko).toBe(3)
    b.reset('chaos')
    expect(b.difficulty).toBe('chaos')
    b.debug.damageAll(lethal)
    b.step(STEP, idle)
    expect(b.ko).toBe(1)
  })

  it('不指定難度時沿用上一場的難度', () => {
    const b = battle([farCaptain()])
    b.reset('hard')
    b.reset()
    expect(b.difficulty).toBe('hard')
  })

  it('擊破數跨過戰況門檻時送出一次 phase', () => {
    const spawns = Array.from({ length: 60 }, (_, i) => spear((i % 10) * 3 - 15, 20 + Math.floor(i / 10) * 3))
    const b = battle([...spawns, farCaptain()])
    expect(stepFor(b, 0.2)).not.toContain('phase')
    b.debug.damageAll(60)
    b.step(STEP, idle)
    expect(b.ko).toBe(60)
    const types = stepFor(b, 0.5)
    expect(types.filter((t) => t === 'phase')).toHaveLength(1)
    expect(b.phase).toBe('pressure')
  })
})
