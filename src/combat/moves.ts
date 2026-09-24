import type { HitShape } from './hitshape.ts'

export type Reaction = 'flinch' | 'launch' | 'knockback' | 'blowaway' | 'knockdown'
export type MoveId =
  | 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'N6'
  | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6'
  | 'JA' | 'JC' | 'MUSOU'
export type HitSfx = 'light' | 'heavy' | 'pierce'
export type HitFx = 'shockwave' | 'blast'

export interface HitWindow {
  t0: number // 判定開始（秒，從出招起算）
  t1: number // 判定結束
  shape: HitShape
  damage: number
  reaction: Reaction
  push: number // 水平擊退速度 m/s
  lift: number // 上抬速度 m/s
  hitstop: number // 命中停頓秒數
  shake: number // 鏡頭震動 0..1
  sfx: HitSfx
  radial?: boolean // 擊退方向：true 由判定中心向外，否則沿攻擊者面向
  yMin?: number // 相對攻擊者腳底的有效高度
  yMax?: number
  fx?: HitFx // 判定啟動時的地面特效
}

export interface Lunge {
  t0: number
  t1: number
  distance: number
}

export interface MoveDef {
  id: MoveId
  name: string
  duration: number
  cancel: number // 最早可接下一招的時間
  hits: HitWindow[]
  lunge: Lunge[] // 出招時的前衝位移
  trail: [number, number][] // 刀光顯示區間
  swings: number[] // 揮擊音效時間點
  armor?: boolean // 霸體：受擊只扣血不硬直
  airborne?: boolean // 空中招式
  /** 腳底高度曲線 [時間, 高度]；relative 時數值是出招瞬間高度的倍率。 */
  height?: { keys: [number, number][]; relative?: boolean }
}

const DEG = Math.PI / 180

const arc = (range: number, halfDeg: number, offset = 0): HitShape => ({ kind: 'arc', range, halfAngle: halfDeg * DEG, offset })
const circle = (range: number, offset = 0): HitShape => ({ kind: 'circle', range, offset })
const line = (range: number, width: number, offset = 0): HitShape => ({ kind: 'line', range, width, offset })

function hit(t0: number, t1: number, shape: HitShape, damage: number, reaction: Reaction, extra: Partial<HitWindow> = {}): HitWindow {
  return { t0, t1, shape, damage, reaction, push: 3, lift: 0, hitstop: 0.05, shake: 0.12, sfx: 'light', ...extra }
}

// ── 一般攻擊 N1–N6 ───────────────────────────────────────────

const N1: MoveDef = {
  id: 'N1', name: '刺', duration: 0.42, cancel: 0.2,
  hits: [hit(0.1, 0.16, line(3.4, 1.3), 14, 'flinch', { push: 3, sfx: 'pierce' })],
  lunge: [{ t0: 0, t1: 0.12, distance: 0.35 }], trail: [[0.06, 0.2]], swings: [0.06],
}

const N2: MoveDef = {
  id: 'N2', name: '橫掃', duration: 0.46, cancel: 0.22,
  hits: [hit(0.1, 0.22, arc(3.3, 80), 14, 'flinch', { push: 3.5 })],
  lunge: [{ t0: 0, t1: 0.14, distance: 0.4 }], trail: [[0.06, 0.26]], swings: [0.07],
}

const N3: MoveDef = {
  id: 'N3', name: '回掃', duration: 0.46, cancel: 0.22,
  hits: [hit(0.1, 0.22, arc(3.3, 80), 15, 'flinch', { push: 3.5 })],
  lunge: [{ t0: 0, t1: 0.14, distance: 0.4 }], trail: [[0.05, 0.26]], swings: [0.06],
}

const N4: MoveDef = {
  id: 'N4', name: '雙突', duration: 0.55, cancel: 0.32,
  hits: [
    hit(0.1, 0.14, line(3.6, 1.4), 11, 'flinch', { sfx: 'pierce' }),
    hit(0.24, 0.28, line(3.8, 1.5), 12, 'flinch', { push: 4.5, sfx: 'pierce' }),
  ],
  lunge: [{ t0: 0, t1: 0.12, distance: 0.35 }, { t0: 0.17, t1: 0.26, distance: 0.35 }],
  trail: [[0.06, 0.32]], swings: [0.07, 0.2],
}

const N5: MoveDef = {
  id: 'N5', name: '旋槍', duration: 0.6, cancel: 0.36,
  hits: [hit(0.12, 0.3, circle(3.4), 16, 'knockback', { push: 6.5, radial: true, hitstop: 0.06, shake: 0.18 })],
  lunge: [{ t0: 0.05, t1: 0.3, distance: 0.5 }], trail: [[0.08, 0.34]], swings: [0.1, 0.2],
}

const N6: MoveDef = {
  id: 'N6', name: '龍牙突', duration: 0.85, cancel: 0.62,
  hits: [hit(0.14, 0.24, line(4.8, 2.2), 26, 'blowaway', { push: 15, lift: 4.5, hitstop: 0.09, shake: 0.45, sfx: 'heavy' })],
  lunge: [{ t0: 0.08, t1: 0.22, distance: 1.7 }], trail: [[0.08, 0.3]], swings: [0.1],
}

// ── 蓄力攻擊 C1–C6 ───────────────────────────────────────────

const C1: MoveDef = {
  id: 'C1', name: '挑槍', duration: 0.72, cancel: 0.52,
  hits: [hit(0.14, 0.24, arc(3.3, 60), 18, 'launch', { push: 2, lift: 8, hitstop: 0.07, shake: 0.25, sfx: 'heavy' })],
  lunge: [{ t0: 0.05, t1: 0.2, distance: 0.5 }], trail: [[0.1, 0.3]], swings: [0.12],
}

const C2: MoveDef = {
  id: 'C2', name: '昇龍', duration: 0.78, cancel: 0.55,
  hits: [hit(0.16, 0.28, arc(3.6, 75), 20, 'launch', { push: 1.5, lift: 10.5, hitstop: 0.08, shake: 0.3, sfx: 'heavy' })],
  lunge: [{ t0: 0.05, t1: 0.22, distance: 0.6 }], trail: [[0.1, 0.32]], swings: [0.14],
  height: { keys: [[0, 0], [0.14, 0], [0.24, 0.55], [0.4, 0]] },
}

const AIR = { yMin: -4, yMax: 5 }

const C3: MoveDef = {
  id: 'C3', name: '追龍', duration: 1.2, cancel: 1.0,
  hits: [
    hit(0.14, 0.24, arc(3.5, 70), 16, 'launch', { lift: 10, push: 1.5, hitstop: 0.06, shake: 0.2, sfx: 'heavy' }),
    hit(0.36, 0.44, arc(3.4, 85), 12, 'launch', { lift: 6, push: 1, hitstop: 0.05, ...AIR }),
    hit(0.52, 0.6, arc(3.4, 85), 12, 'launch', { lift: 6, push: 1, hitstop: 0.05, ...AIR }),
    hit(0.68, 0.76, arc(3.4, 85), 13, 'launch', { lift: 6, push: 1, hitstop: 0.05, ...AIR }),
    hit(0.88, 0.98, circle(3.4), 24, 'knockdown', {
      push: 4, radial: true, yMin: -1, yMax: 5, hitstop: 0.1, shake: 0.45, sfx: 'heavy', fx: 'shockwave',
    }),
  ],
  lunge: [{ t0: 0.05, t1: 0.22, distance: 0.6 }, { t0: 0.3, t1: 0.8, distance: 0.8 }],
  trail: [[0.1, 0.95]], swings: [0.14, 0.37, 0.53, 0.69, 0.86],
  height: { keys: [[0, 0], [0.12, 0], [0.34, 3.1], [0.8, 3.3], [0.9, 0]] },
}

const C4: MoveDef = {
  id: 'C4', name: '迴龍掃', duration: 0.9, cancel: 0.7, armor: true,
  hits: [
    hit(0.14, 0.3, circle(3.9), 16, 'knockback', { push: 7, radial: true, hitstop: 0.05, shake: 0.2 }),
    hit(0.36, 0.52, circle(4.1), 18, 'blowaway', { push: 12, lift: 3.5, radial: true, hitstop: 0.08, shake: 0.35, sfx: 'heavy' }),
  ],
  lunge: [{ t0: 0.1, t1: 0.5, distance: 0.8 }], trail: [[0.1, 0.56]], swings: [0.14, 0.26, 0.38, 0.5],
}

const C5: MoveDef = {
  id: 'C5', name: '百烈槍', duration: 1.35, cancel: 1.12, armor: true,
  hits: [
    ...Array.from({ length: 8 }, (_, i) => {
      const t0 = 0.11 + i * 0.08
      return hit(t0, t0 + 0.04, arc(3.6, 32), 7, 'flinch', { push: 1.2, hitstop: 0.025, shake: 0.08, sfx: 'pierce' })
    }),
    hit(0.9, 1.0, line(4.8, 2.4), 30, 'blowaway', { push: 17, lift: 4.5, hitstop: 0.11, shake: 0.55, sfx: 'heavy' }),
  ],
  lunge: [{ t0: 0.08, t1: 0.72, distance: 0.9 }, { t0: 0.82, t1: 0.96, distance: 1.3 }],
  trail: [[0.08, 1.05]], swings: [0.1, 0.26, 0.42, 0.58, 0.88],
}

const C6: MoveDef = {
  id: 'C6', name: '天龍破', duration: 1.3, cancel: 1.08, armor: true,
  hits: [
    hit(0.1, 0.2, arc(3.2, 70), 14, 'launch', { lift: 7, push: 2, hitstop: 0.05, shake: 0.2 }),
    hit(0.56, 0.66, circle(6.5), 42, 'blowaway', {
      push: 16, lift: 6.5, radial: true, yMin: -1, yMax: 4, hitstop: 0.15, shake: 0.95, sfx: 'heavy', fx: 'shockwave',
    }),
  ],
  lunge: [{ t0: 0.12, t1: 0.52, distance: 2.2 }], trail: [[0.08, 0.6]], swings: [0.1, 0.4],
  height: { keys: [[0, 0], [0.12, 0], [0.36, 3.6], [0.48, 3.8], [0.56, 0]] },
}

// ── 空中攻擊 ────────────────────────────────────────────────

const JA: MoveDef = {
  id: 'JA', name: '落鳳', duration: 0.5, cancel: 0.42, airborne: true,
  hits: [hit(0.14, 0.22, circle(2.8), 16, 'knockdown', { push: 5, radial: true, hitstop: 0.06, shake: 0.3, sfx: 'heavy', fx: 'shockwave' })],
  lunge: [{ t0: 0, t1: 0.16, distance: 1.2 }], trail: [[0.02, 0.2]], swings: [0.04],
  height: { keys: [[0, 1], [0.16, 0]], relative: true },
}

const JC: MoveDef = {
  id: 'JC', name: '旋空', duration: 0.6, cancel: 0.5, airborne: true,
  hits: [hit(0.08, 0.34, circle(3.3), 14, 'knockdown', { push: 4, radial: true, yMin: -3, yMax: 3, hitstop: 0.05, shake: 0.2 })],
  lunge: [], trail: [[0.06, 0.36]], swings: [0.08, 0.22],
  height: { keys: [[0, 1], [0.3, 1.05], [0.46, 0]], relative: true },
}

// ── 無雙亂舞 ────────────────────────────────────────────────

export const MUSOU_FINALE = 3.02

const MUSOU: MoveDef = {
  id: 'MUSOU', name: '蒼龍破陣', duration: 3.6, cancel: 3.6, armor: true,
  hits: [
    ...Array.from({ length: 19 }, (_, i) => {
      const t0 = 0.32 + i * 0.12
      return hit(t0, t0 + 0.05, circle(4.4), 11, 'launch', {
        push: 2.5, lift: 3.2, radial: true, yMin: -1, yMax: 6, hitstop: 0.012, shake: 0.12,
      })
    }),
    hit(MUSOU_FINALE, MUSOU_FINALE + 0.1, circle(9.5), 70, 'blowaway', {
      push: 20, lift: 8, radial: true, yMin: -2, yMax: 8, hitstop: 0.22, shake: 1, sfx: 'heavy', fx: 'blast',
    }),
  ],
  lunge: [{ t0: 2.95, t1: 3.1, distance: 2.5 }],
  trail: [[0.3, 3.2]], swings: [0.35, 0.8, 1.25, 1.7, 2.15, 2.98],
}

export const MOVES: Record<MoveId, MoveDef> = { N1, N2, N3, N4, N5, N6, C1, C2, C3, C4, C5, C6, JA, JC, MUSOU }
