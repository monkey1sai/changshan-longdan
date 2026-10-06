import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { HitWindow } from '../src/combat/moves.ts'
import type { BattleEvent } from '../src/entities/battle.ts'
import { Kind, type HitInfo, type KillInfo } from '../src/entities/enemies.ts'
import { MUSIC_LEVEL, Presentation, type AudioSink, type PresentationSinks, type PresentationSource } from '../src/presentation.ts'
import { t } from '../src/ui/i18n.ts'

type Call = [string, ...unknown[]]

const AUDIO: (keyof AudioSink)[] = ['swing', 'jump', 'land', 'dodge', 'hit', 'shatter', 'enemySwing', 'playerHurt', 'musouStart',
  'dragonRoar', 'musouBlast', 'musouReady', 'milestone', 'victory', 'defeat', 'setMusicLevel']

/** 只記錄呼叫的輸出端；鏡頭在原點朝 +z，右方 +x，pan = x / 12 × 0.7。 */
function rig(audioOn = true) {
  const calls: Call[] = []
  const rec = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]) }
  const audio = Object.fromEntries(AUDIO.map((k) => [k, rec(`audio.${String(k)}`)])) as unknown as AudioSink
  const post = { aberration: 0, radial: 0, flash: 0 }
  const sinks: PresentationSinks = {
    audio: () => (audioOn ? audio : null),
    sparks: { burst: rec('sparks.burst'), glitter: rec('sparks.glitter') },
    dust: { puff: rec('dust.puff'), ring: rec('dust.ring') },
    waves: { ring: rec('waves.ring'), pillar: rec('waves.pillar') },
    fragments: { spawnSoldier: rec('fragments.spawnSoldier') },
    camera: { addTrauma: rec('camera.addTrauma'), kick: rec('camera.kick'), right: new Vector3(1, 0, 0), camera: { position: new Vector3() } },
    post,
    hud: { showBanner: rec('hud.showBanner'), playCutin: rec('hud.playCutin') },
    dragon: { randomPoint: (_rng: () => number, out: Vector3) => out.set(1, 2, 3) },
    rng: () => 0.5,
  }
  return { calls, post, sinks, presentation: new Presentation(sinks), named: (name: string) => calls.filter((c) => c[0] === name) }
}

const hitAt = (x: number, z: number): HitInfo => ({ id: 0, x, y: 0, z, dirX: 0, dirZ: 1, killed: false })
const killAt = (x: number, z: number): KillInfo => ({ id: 0, x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw: 0, spin: 0, kind: Kind.Spear })
function source(hits: HitInfo[] = [], kills: KillInfo[] = []): PresentationSource {
  return { hits, kills, player: { pos: new Vector3(0, 0, 0), facing: 0 } }
}
const win = (extra: Partial<HitWindow>): HitWindow => ({
  t0: 0, t1: 0.1, shape: { kind: 'circle', range: 3 }, damage: 10, reaction: 'flinch', push: 3, lift: 0, hitstop: 0.05, shake: 0.1, sfx: 'light', ...extra,
})
const pan = (x: number) => (x / 12) * 0.7

describe('Presentation 命中', () => {
  it('一般命中：震動、每個命中點 7 顆火花、以第一個命中點計算聲道', () => {
    const r = rig()
    const hits = [hitAt(6, 2), hitAt(1, 2)]
    r.presentation.play([{ type: 'hit', window: win({ shake: 0.12 }), start: 0, count: 2 }], source(hits))
    expect(r.named('camera.addTrauma')).toEqual([['camera.addTrauma', 0.12]])
    expect(r.named('camera.kick')).toEqual([])
    expect(r.named('sparks.burst').map((c) => c[6])).toEqual([7, 7])
    expect(r.named('audio.hit')).toEqual([['audio.hit', 'light', 2, pan(6)]])
  })

  it('重擊且超過 3 人：震動 ×1.15、kick 0.5、色差 0.8、每點 12 顆重火花', () => {
    const r = rig()
    const hits = [hitAt(0, 1), hitAt(0, 2), hitAt(0, 3), hitAt(0, 4)]
    r.presentation.play([{ type: 'hit', window: win({ sfx: 'heavy', shake: 0.4 }), start: 0, count: 4 }], source(hits))
    expect(r.named('camera.addTrauma')[0][1]).toBeCloseTo(0.46)
    expect(r.named('camera.kick')).toEqual([['camera.kick', 0.5]])
    expect(r.post.aberration).toBe(0.8)
    expect(r.named('sparks.burst').map((c) => [c[6], c[7]])).toEqual([[12, true], [12, true], [12, true], [12, true]])
  })

  it('蒼龍撞擊：每點 6 顆一般火花、輕擊音效，沒有鏡頭震動（現有配方）', () => {
    const r = rig()
    r.presentation.play([{ type: 'dragonHit', start: 0, count: 2, x: 3, z: 0 }], source([hitAt(0, 1), hitAt(0, 2)]))
    expect(r.named('sparks.burst').map((c) => [c[6], c[7]])).toEqual([[6, false], [6, false]])
    expect(r.named('audio.hit')).toEqual([['audio.hit', 'light', 2, pan(3)]])
    expect(r.named('camera.addTrauma')).toEqual([])
  })

  it('擊殺：每名敵兵碎片與塵土，碎裂音效以第一名計算聲道', () => {
    const r = rig()
    r.presentation.play([{ type: 'kill', start: 0, count: 2 }], source([], [killAt(-6, 3), killAt(2, 3)]))
    expect(r.named('fragments.spawnSoldier')).toHaveLength(2)
    expect(r.named('dust.puff').map((c) => [c[1], c[3], c[4], c[5]])).toEqual([[-6, 3, 3, 2.5], [2, 3, 3, 2.5]])
    expect(r.named('audio.shatter')).toEqual([['audio.shatter', 2, pan(-6)]])
  })
})

describe('Presentation 防禦與受傷', () => {
  it('完美招架：18 顆火花朝事件帶的朝向、震動 0.12、白色衝擊環', () => {
    const r = rig()
    r.presentation.play([{ type: 'parry', x: 6, z: 2, facing: Math.PI / 2 }], source())
    const burst = r.named('sparks.burst')[0]
    expect(burst[4]).toBeCloseTo(1)
    expect(burst[5]).toBeCloseTo(0)
    expect([burst[6], burst[7]]).toEqual([18, true])
    expect(r.named('camera.addTrauma')).toEqual([['camera.addTrauma', 0.12]])
    expect(r.named('waves.ring')).toHaveLength(1)
    expect(r.named('audio.hit')).toEqual([['audio.hit', 'pierce', 1, pan(6)]])
  })

  it('一般格擋：6 顆火花、震動 0.04、沒有衝擊環', () => {
    const r = rig()
    r.presentation.play([{ type: 'guardBlock', x: 0, z: 2, facing: 0, heavy: false, damage: 6 }], source())
    expect(r.named('sparks.burst').map((c) => [c[6], c[7]])).toEqual([[6, false]])
    expect(r.named('camera.addTrauma')).toEqual([['camera.addTrauma', 0.04]])
    expect(r.named('waves.ring')).toEqual([])
  })

  it('受傷：受傷音效、輕／重震動，火花往遠離攻擊者的方向', () => {
    const r = rig()
    r.presentation.play([{ type: 'hurt', x: 0, z: 2, heavy: false }, { type: 'hurt', x: 0, z: 2, heavy: true }], source())
    expect(r.named('audio.playerHurt')).toEqual([['audio.playerHurt', false], ['audio.playerHurt', true]])
    expect(r.named('camera.addTrauma')).toEqual([['camera.addTrauma', 0.25], ['camera.addTrauma', 0.45]])
    expect(r.named('sparks.burst').map((c) => [c[4], c[5], c[7]])).toEqual([[0, -1, false], [0, -1, true]])
  })
})

describe('Presentation 無雙', () => {
  it('開始：切入畫面、無雙音效、壓低音樂、震動 0.35、radial 1', () => {
    const r = rig()
    r.presentation.play([{ type: 'musouStart' }], source())
    expect(r.named('hud.playCutin')).toHaveLength(1)
    expect(r.named('audio.musouStart')).toHaveLength(1)
    expect(r.named('audio.setMusicLevel')).toEqual([['audio.setMusicLevel', 0.14, 0.2]])
    expect(r.named('camera.addTrauma')).toEqual([['camera.addTrauma', 0.35]])
    expect(r.post.radial).toBe(1)
  })

  it('兩聲龍吼各在 0.35 秒與 2.75 秒後響一次，每幀 5 顆金色光點', () => {
    const r = rig()
    r.presentation.play([{ type: 'musouStart' }], source())
    for (const t of [0.2, 0.36, 0.5, 2.7, 2.76, 3.0]) r.presentation.dragonFrame({ active: true, elapsed: t })
    expect(r.named('audio.dragonRoar')).toHaveLength(2)
    expect(r.named('sparks.glitter')).toHaveLength(30)
    r.presentation.play([{ type: 'musouStart' }], source())
    r.presentation.dragonFrame({ active: true, elapsed: 0.4 })
    expect(r.named('audio.dragonRoar')).toHaveLength(3)
  })

  it('蒼龍已不在攻擊（畫面淡出中）時只有光點、沒有龍吼', () => {
    const r = rig()
    r.presentation.play([{ type: 'musouStart' }], source())
    r.presentation.dragonFrame({ active: false, elapsed: 3.0 })
    expect(r.named('audio.dragonRoar')).toEqual([])
    expect(r.named('sparks.glitter')).toHaveLength(5)
  })

  it('reset() 後不會把上一場的無雙誤判為剛結束', () => {
    const r = rig()
    r.presentation.musouState(true, true)
    r.presentation.reset()
    r.presentation.musouState(false, true)
    expect(r.named('audio.setMusicLevel')).toEqual([])
  })

  it('無雙結束只在戰鬥進行中恢復音樂音量', () => {
    const r = rig()
    r.presentation.musouState(true, true)
    r.presentation.musouState(false, true)
    expect(r.named('audio.setMusicLevel')).toEqual([['audio.setMusicLevel', MUSIC_LEVEL, 1]])
    r.presentation.musouState(true, true)
    r.presentation.musouState(false, false)
    expect(r.named('audio.setMusicLevel')).toHaveLength(1)
  })

  it('收尾撞地：在趙雲前方 6 公尺放金色衝擊環與光柱、閃光、最大震動', () => {
    const r = rig()
    r.presentation.play([{ type: 'fx', fx: 'blast', x: 0, z: 0, radius: 9 }], source())
    expect(r.named('waves.ring').map((c) => [c[1], c[2], c[3]])).toEqual([[0, 6, 12], [0, 6, 6]])
    expect(r.named('waves.pillar')).toHaveLength(1)
    expect(r.named('audio.musouBlast')).toHaveLength(1)
    expect(r.post).toMatchObject({ flash: 0.5, radial: 1 })
    expect(r.named('camera.kick')).toEqual([['camera.kick', 1]])
  })
})

describe('Presentation 動作與地面特效', () => {
  it('衝擊波：環寬 ×1.1、塵土環 26 顆、震動 0.3、radial 至少 0.5', () => {
    const r = rig()
    r.post.radial = 0.8
    r.presentation.play([{ type: 'fx', fx: 'shockwave', x: 1, z: 2, radius: 4 }], source())
    const ring = r.named('waves.ring')[0]
    expect([ring[1], ring[2], ring[4]]).toEqual([1, 2, 0.45])
    expect(ring[3]).toBeCloseTo(4.4)
    expect(r.named('dust.ring').map((c) => [c[1], c[2], c[3], c[4]])).toEqual([[1, 2, 4, 26]])
    expect(r.named('camera.addTrauma')).toEqual([['camera.addTrauma', 0.3]])
    expect(r.post.radial).toBe(0.8)
    r.post.radial = 0
    r.presentation.play([{ type: 'fx', fx: 'shockwave', x: 0, z: 0, radius: 4 }], source())
    expect(r.post.radial).toBe(0.5)
  })

  it('落地：輕／重各自的塵土量，重落地加震動 0.15；閃避塵土 6 顆', () => {
    const r = rig()
    r.presentation.play([{ type: 'land', heavy: false }, { type: 'land', heavy: true }, { type: 'dodge' }], source())
    expect(r.named('dust.puff').map((c) => [c[4], c[5]])).toEqual([[8, 3], [16, 5], [6, 2.5]])
    expect(r.named('camera.addTrauma')).toEqual([['camera.addTrauma', 0.15]])
    expect(r.named('audio.land')).toEqual([['audio.land', false], ['audio.land', true]])
    expect(r.named('audio.dodge')).toHaveLength(1)
  })

  it('敵兵出手只播揮擊音效，以出手位置計算聲道', () => {
    const r = rig()
    r.presentation.play([{ type: 'enemyStrike', x: -3, z: 5, heavy: true }], source())
    expect(r.calls).toEqual([['audio.enemySwing', pan(-3)]])
  })

  it('聲道在鏡頭左右 12 公尺外截斷在 ±0.7', () => {
    const r = rig()
    r.presentation.play([{ type: 'enemyStrike', x: 40, z: 0, heavy: false }, { type: 'enemyStrike', x: -40, z: 0, heavy: false }], source())
    expect(r.named('audio.enemySwing')).toEqual([['audio.enemySwing', 0.7], ['audio.enemySwing', -0.7]])
  })
})

describe('Presentation 橫幅', () => {
  const banner = (r: ReturnType<typeof rig>, i = 0) => {
    const c = r.named('hud.showBanner')[i]
    return { text: (c[1] as () => string)(), seconds: c[2], tone: c[3] }
  }

  it('里程碑顯示斬數並播放音效；戰況橫幅讀 i18n', () => {
    const r = rig()
    const events: BattleEvent[] = [{ type: 'milestone', ko: 200 }, { type: 'phase', id: 'surge' }]
    r.presentation.play(events, source())
    expect(banner(r, 0)).toMatchObject({ seconds: 2, tone: 'gold' })
    expect(banner(r, 0).text).toContain('200')
    expect(r.named('audio.milestone')).toHaveLength(1)
    expect(banner(r, 1)).toMatchObject({ text: t('battle.surge'), seconds: 2 })
  })

  it('無雙就緒：金色橫幅 1.4 秒與提示音；半數潰滅只有橫幅', () => {
    const r = rig()
    r.presentation.play([{ type: 'musouReady' }, { type: 'halfDefeated' }], source())
    expect(banner(r, 0)).toMatchObject({ seconds: 1.4, tone: 'gold' })
    expect(r.named('audio.musouReady')).toHaveLength(1)
    expect(banner(r, 1)).toMatchObject({ seconds: 2 })
    expect(r.calls.filter((c) => String(c[0]).startsWith('audio.'))).toHaveLength(1)
  })

  it('勝利與敗北各有橫幅、音效與音樂音量', () => {
    const r = rig()
    r.presentation.play([{ type: 'victory' }, { type: 'defeat' }], source())
    expect(banner(r, 0)).toMatchObject({ seconds: 3, tone: 'gold' })
    expect(banner(r, 1)).toMatchObject({ seconds: 3 })
    expect(r.named('audio.victory')).toHaveLength(1)
    expect(r.named('audio.defeat')).toHaveLength(1)
    expect(r.named('audio.setMusicLevel')).toEqual([['audio.setMusicLevel', 0.2], ['audio.setMusicLevel', 0.12]])
  })
})

describe('Presentation 音訊尚未解鎖', () => {
  it('沒有音效引擎時其他回饋照常播放、不丟例外', () => {
    const r = rig(false)
    const events: BattleEvent[] = [
      { type: 'hit', window: win({ sfx: 'heavy' }), start: 0, count: 1 }, { type: 'musouStart' }, { type: 'victory' },
      { type: 'enemyStrike', x: 0, z: 1, heavy: false }, { type: 'land', heavy: true },
    ]
    expect(() => r.presentation.play(events, source([hitAt(0, 1)]))).not.toThrow()
    r.presentation.dragonFrame({ active: true, elapsed: 1 })
    r.presentation.musouState(false, true)
    expect(r.calls.some((c) => String(c[0]).startsWith('audio.'))).toBe(false)
    expect(r.named('sparks.burst')).toHaveLength(1)
    expect(r.named('hud.playCutin')).toHaveLength(1)
    expect(r.named('dust.puff')).toHaveLength(1)
  })
})
