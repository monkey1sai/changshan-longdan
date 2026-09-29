import type { MoveId } from '../combat/moves.ts'
import { easeOutCubic, lerp, smoothstep, TAU, wrapAngle } from '../core/math.ts'

/**
 * 趙雲的姿勢參數（角色本地座標：+z 前方、+x 左方、+y 上方）。
 * 只描述槍與身體；雙手由 IK 自動握到槍上。
 */
export interface Pose {
  lean: number // 上身前傾
  twist: number // 上身扭轉（+ 向左）
  crouch: number // 腰部高度偏移（負值下蹲）
  spin: number // 整體繞 Y 的額外旋轉（旋轉招式）
  flip: number // 繞腰部 X 軸翻滾（閃避、倒地）
  gx: number // 右手握槍點
  gy: number
  gz: number
  yaw: number // 槍身水平角（0 = 正前方，+ 向左）
  pitch: number // 槍身仰角（+ 槍尖朝上）
  roll: number
  stance: number // 弓步程度
  lh: number // 左手握槍權重 0..1
}

const FIELDS: (keyof Pose)[] = ['lean', 'twist', 'crouch', 'spin', 'flip', 'gx', 'gy', 'gz', 'yaw', 'pitch', 'roll', 'stance', 'lh']

export function blankPose(): Pose {
  return { lean: 0, twist: 0, crouch: 0, spin: 0, flip: 0, gx: 0, gy: 0, gz: 0, yaw: 0, pitch: 0, roll: 0, stance: 0, lh: 0 }
}

export function copyPose(out: Pose, src: Pose): Pose {
  for (const f of FIELDS) out[f] = src[f]
  return out
}

/** 同一段動畫內的插值：旋轉量照數值走（可轉超過一圈）。 */
export function mixPose(out: Pose, a: Pose, b: Pose, t: number): Pose {
  for (const f of FIELDS) out[f] = lerp(a[f], b[f], t)
  return out
}

/** 不同動作之間的淡入：整體旋轉取最短方向，避免倒轉一整圈。 */
export function crossfade(out: Pose, from: Pose, to: Pose, t: number): Pose {
  mixPose(out, from, to, t)
  out.spin = from.spin + wrapAngle(to.spin - from.spin) * t
  out.flip = from.flip + wrapAngle(to.flip - from.flip) * t
  return out
}

export const STANCE: Pose = {
  lean: 0.08, twist: -0.1, crouch: -0.05, spin: 0, flip: 0,
  gx: -0.16, gy: 1.08, gz: 0.2, yaw: 0.25, pitch: -0.18, roll: 0, stance: 0.4, lh: 1,
}

const P = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o })

export const RUN = P({ lean: 0.3, twist: 0, crouch: -0.02, gx: -0.3, gy: 1.02, gz: -0.08, yaw: -2.75, pitch: 0.35, stance: 0, lh: 0 })
export const AIR = P({ lean: 0.1, crouch: 0, gx: -0.25, gy: 1.2, gz: 0, yaw: -2.5, pitch: 0.5, stance: 0, lh: 0 })
export const HURT = P({ lean: -0.35, twist: 0.25, crouch: -0.1, gx: -0.3, gy: 1.1, gz: -0.05, yaw: -1.9, pitch: 0.6, lh: 0, stance: 0.2 })
export const DOWN = P({ lean: 0, flip: -Math.PI / 2, crouch: -0.7, gx: -0.35, gy: 0.95, gz: 0, yaw: -1.6, pitch: 0.1, lh: 0, stance: 0 })
export const ROLL = P({ lean: 0.4, crouch: -0.45, gx: -0.2, gy: 1.0, gz: 0.1, yaw: -2.6, pitch: 0.3, lh: 0, stance: 0 })
/** 橫槍護身：槍刃朝上，讓防禦在遠距也有清楚輪廓。 */
export const GUARD = P({ lean: -0.08, twist: -0.24, crouch: -0.14, gx: -0.3, gy: 1.36, gz: 0.18, yaw: -0.72, pitch: 0.52, roll: -0.08, stance: 0.88, lh: 1 })

interface Key {
  t: number
  p: Pose
}

const k = (t: number, o: Partial<Pose> = {}): Key => ({ t, p: P(o) })

const SIDE: Partial<Pose> = { gx: -0.36, gy: 1.12, gz: 0.02, yaw: -1.55, pitch: 0.02, twist: -0.3, crouch: -0.12, lh: 0 }
const THRUST: Partial<Pose> = { gx: -0.12, gy: 1.2, gz: 0.62, yaw: 0, pitch: 0.02, lean: 0.28, twist: 0.15, stance: 1 }
const C2_LOW: Partial<Pose> = { gx: -0.3, gy: 0.9, gz: 0.3, yaw: -0.6, pitch: -0.9, lean: 0.3, crouch: -0.28, twist: -0.4, stance: 0.9 }
const C2_HIGH: Partial<Pose> = { gx: -0.1, gy: 1.55, gz: 0.3, yaw: 0.4, pitch: 1.45, lean: -0.2, twist: 0.3, crouch: 0.05, stance: 0.4 }
const BIG_WIND: Partial<Pose> = { gx: -0.24, gy: 1.1, gz: -0.25, yaw: 0.05, pitch: 0.05, twist: -0.55, lean: -0.05, crouch: -0.18, stance: 0.8 }
const BIG_THRUST: Partial<Pose> = { gx: -0.1, gy: 1.18, gz: 0.72, yaw: 0, pitch: 0.02, twist: 0.3, lean: 0.5, crouch: -0.25, stance: 1.2 }
const SLAM: Partial<Pose> = { gx: -0.08, gy: 0.85, gz: 0.55, yaw: 0, pitch: -1.25, lean: 0.6, crouch: -0.45, stance: 1.2 }

function barrage(): Key[] {
  const keys: Key[] = [k(0), k(0.08, { gx: -0.2, gy: 1.15, gz: 0, yaw: 0, pitch: 0, lean: 0.1, twist: -0.3, stance: 1 })]
  for (let i = 0; i < 8; i++) {
    const t = 0.12 + i * 0.08
    keys.push(k(t, { ...THRUST, gy: 1.12 + (i % 3) * 0.05, yaw: i % 2 === 0 ? -0.22 : 0.22, pitch: ((i % 3) - 1) * 0.1, lean: 0.3 }))
    keys.push(k(t + 0.04, { gx: -0.2, gy: 1.15, gz: 0.12, yaw: 0, lean: 0.2, twist: -0.2, stance: 1 }))
  }
  keys.push(k(0.8, { ...BIG_WIND, twist: -0.6 }), k(0.93, BIG_THRUST), k(1.15, BIG_THRUST), k(1.35))
  return keys
}

const ANIMS: Record<Exclude<MoveId, 'MUSOU'>, Key[]> = {
  DASH: [
    k(0, { ...GUARD, gx: -0.34, gy: 1.04, gz: -0.1, yaw: -0.22, pitch: -0.18, lean: 0.32, crouch: -0.26, lh: 0 }),
    k(0.055, { gx: -0.2, gy: 1.08, gz: 0.08, yaw: -0.08, pitch: -0.08, lean: 0.38, crouch: -0.25, stance: 1.05, lh: 0 }),
    k(0.13, { ...THRUST, gx: -0.13, gy: 1.12, gz: 0.88, pitch: -0.04, lean: 0.48, crouch: -0.22, stance: 1.25 }),
    k(0.24, { ...THRUST, gx: -0.13, gy: 1.12, gz: 0.88, pitch: -0.04, lean: 0.48, crouch: -0.22, stance: 1.25 }),
    k(0.38),
  ],
  COUNTER: [
    k(0, GUARD),
    k(0.075, { gx: 0.08, gy: 1.48, gz: -0.02, yaw: 1.28, pitch: 0.72, twist: 0.62, lean: -0.2, crouch: -0.08, stance: 0.72, lh: 0 }),
    k(0.18, { ...BIG_THRUST, gx: -0.08, gy: 1.24, gz: 0.9, yaw: -0.1, pitch: 0.08, twist: 0.18, lean: 0.55, crouch: -0.2, stance: 1.25 }),
    k(0.36, { ...BIG_THRUST, gx: -0.08, gy: 1.24, gz: 0.9, yaw: -0.1, pitch: 0.08, twist: 0.18, lean: 0.55, crouch: -0.2, stance: 1.25 }),
    k(0.62),
  ],
  N1: [k(0), k(0.06, { gx: -0.2, gy: 1.15, gz: -0.05, yaw: 0.05, pitch: 0, lean: 0, twist: -0.35 }), k(0.12, THRUST), k(0.24, THRUST), k(0.42)],
  N2: [
    k(0),
    k(0.07, { gx: -0.36, gy: 1.2, gz: 0.05, yaw: -1.35, pitch: 0.08, twist: -0.6, lean: 0.05, lh: 0 }),
    k(0.16, { gx: -0.1, gy: 1.2, gz: 0.35, yaw: 0.1, pitch: 0.05, twist: 0, lean: 0.18, stance: 0.8, lh: 0 }),
    k(0.24, { gx: 0.18, gy: 1.15, gz: 0.2, yaw: 1.45, pitch: 0.02, twist: 0.6, lean: 0.12, stance: 0.8, lh: 0 }),
    k(0.46),
  ],
  N3: [
    k(0, { gx: 0.1, yaw: 1.2, twist: 0.5, lh: 0 }),
    k(0.06, { gx: 0.15, gy: 1.2, gz: 0.15, yaw: 1.4, pitch: 0.1, twist: 0.55, lh: 0 }),
    k(0.16, { gx: -0.1, gy: 1.25, gz: 0.4, yaw: 0, pitch: 0.18, twist: 0, lean: 0.18, stance: 0.8, lh: 0 }),
    k(0.24, { gx: -0.38, gy: 1.3, gz: 0.1, yaw: -1.5, pitch: 0.3, twist: -0.6, stance: 0.8, lh: 0 }),
    k(0.46),
  ],
  N4: [
    k(0),
    k(0.05, { gx: -0.2, gy: 1.12, gz: -0.05, yaw: 0.02, pitch: -0.05, twist: -0.3, lean: 0.05 }),
    k(0.11, { ...THRUST, yaw: -0.08, pitch: -0.02, lean: 0.3 }),
    k(0.17, { gx: -0.2, gy: 1.18, gz: 0, yaw: 0.08, pitch: 0.02, lean: 0.1, twist: -0.25, stance: 1 }),
    k(0.25, { ...THRUST, gz: 0.66, yaw: 0.08, pitch: 0.04, lean: 0.34, twist: 0.2, stance: 1.1 }),
    k(0.36, { ...THRUST, gz: 0.66, yaw: 0.08, pitch: 0.04, lean: 0.34, twist: 0.2, stance: 1.1 }),
    k(0.55),
  ],
  N5: [k(0), k(0.08, { ...SIDE, spin: 0 }), k(0.32, { ...SIDE, spin: TAU }), k(0.4, { ...SIDE, spin: TAU }), k(0.6, { spin: TAU })],
  N6: [k(0), k(0.1, BIG_WIND), k(0.2, { ...BIG_THRUST, twist: 0.25, lean: 0.45, gz: 0.7 }), k(0.5, { ...BIG_THRUST, twist: 0.25, lean: 0.45, gz: 0.7 }), k(0.85)],
  C1: [
    k(0),
    k(0.1, { gx: -0.25, gy: 0.95, gz: 0.3, yaw: 0.1, pitch: -0.75, lean: 0.25, crouch: -0.2, twist: -0.2, stance: 0.8 }),
    k(0.22, { gx: -0.15, gy: 1.5, gz: 0.35, yaw: 0.05, pitch: 1.25, lean: -0.12, crouch: 0, twist: 0.1, stance: 0.6 }),
    k(0.45, { gx: -0.15, gy: 1.5, gz: 0.35, yaw: 0.05, pitch: 1.25, lean: -0.12, crouch: 0, twist: 0.1, stance: 0.6 }),
    k(0.72),
  ],
  C2: [k(0), k(0.1, C2_LOW), k(0.24, C2_HIGH), k(0.5, C2_HIGH), k(0.78)],
  C3: [
    k(0),
    k(0.1, C2_LOW),
    k(0.22, C2_HIGH),
    k(0.36, { gx: -0.3, gy: 1.3, gz: 0.2, yaw: -1.2, pitch: 0.1, twist: -0.5, lh: 0, stance: 0 }),
    k(0.44, { gx: 0.1, gy: 1.3, gz: 0.25, yaw: 1.2, pitch: 0.1, twist: 0.5, lh: 0, stance: 0 }),
    k(0.52, { gx: 0.1, gy: 1.35, gz: 0.2, yaw: 1.25, pitch: 0.25, twist: 0.5, lh: 0, stance: 0 }),
    k(0.6, { gx: -0.3, gy: 1.3, gz: 0.25, yaw: -1.2, pitch: 0, twist: -0.5, lh: 0, stance: 0 }),
    k(0.68, { gx: -0.32, gy: 1.35, gz: 0.15, yaw: -1.3, pitch: 0.4, twist: -0.55, lh: 0, stance: 0 }),
    k(0.76, { gx: 0.12, gy: 1.25, gz: 0.25, yaw: 1.3, pitch: -0.2, twist: 0.55, lh: 0, stance: 0 }),
    k(0.82, { gx: -0.1, gy: 1.7, gz: 0.1, yaw: 0, pitch: 1.3, lean: -0.2, stance: 0 }),
    k(0.9, { ...SLAM, crouch: -0.35, pitch: -1.1, gy: 0.95, gz: 0.6, lean: 0.5 }),
    k(1.0, { ...SLAM, crouch: -0.35, pitch: -1.1, gy: 0.95, gz: 0.6, lean: 0.5 }),
    k(1.2),
  ],
  C4: [k(0), k(0.08, { ...SIDE, crouch: -0.2, spin: 0 }), k(0.52, { ...SIDE, crouch: -0.2, spin: 2 * TAU }), k(0.62, { ...SIDE, spin: 2 * TAU }), k(0.9, { spin: 2 * TAU })],
  C5: barrage(),
  C6: [
    k(0),
    k(0.1, { gx: -0.2, gy: 1.3, gz: 0.3, yaw: 0.2, pitch: 0.9, lean: -0.1, stance: 0.5 }),
    k(0.36, { gx: -0.05, gy: 1.8, gz: 0, yaw: 0, pitch: 1.45, lean: -0.3, crouch: 0, stance: 0 }),
    k(0.5, { gx: -0.05, gy: 1.85, gz: -0.05, yaw: 0, pitch: 1.5, lean: -0.35, stance: 0 }),
    k(0.56, SLAM),
    k(0.95, SLAM),
    k(1.3),
  ],
  JA: [
    k(0, { gx: -0.1, gy: 1.5, gz: 0.1, pitch: 1.2, stance: 0, lean: -0.1 }),
    k(0.1, { gx: -0.08, gy: 1.0, gz: 0.4, pitch: -1.35, lean: 0.5, crouch: -0.2, stance: 0 }),
    k(0.2, { gx: -0.08, gy: 0.8, gz: 0.5, pitch: -1.3, crouch: -0.4, stance: 1, lean: 0.5 }),
    k(0.5),
  ],
  JC: [k(0, { ...SIDE, spin: 0, stance: 0 }), k(0.34, { ...SIDE, spin: TAU, stance: 0 }), k(0.46, { ...SIDE, spin: TAU, crouch: -0.3, stance: 0.6 }), k(0.6, { spin: TAU })],
}

function sample(keys: Key[], t: number, out: Pose): Pose {
  if (t <= keys[0].t) return copyPose(out, keys[0].p)
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]
    if (t <= b.t) {
      const a = keys[i - 1]
      return mixPose(out, a.p, b.p, smoothstep(0, 1, (t - a.t) / (b.t - a.t)))
    }
  }
  return copyPose(out, keys[keys.length - 1].p)
}

const RAISE = P({ gx: -0.05, gy: 1.85, gz: 0.05, pitch: 1.5, lean: -0.25, stance: 0.5, lh: 1 })
const RAISE_HIGH = P({ gx: -0.05, gy: 1.9, gz: -0.1, pitch: 1.5, lean: -0.3, crouch: 0, stance: 0.6, spin: 3 * TAU })
const FINAL = P({ ...BIG_THRUST, pitch: -0.2, gz: 0.75, lean: 0.55, crouch: -0.3, spin: 3 * TAU })
const scratch = blankPose()

/** 無雙亂舞：舉槍蓄氣 → 旋轉連刺三圈 → 高舉召龍 → 龍降時全力一突。 */
function musouPose(t: number, out: Pose): Pose {
  if (t < 0.3) return mixPose(out, STANCE, RAISE, smoothstep(0, 1, t / 0.3))
  if (t < 2.6) {
    const u = t - 0.3
    const n = Math.floor(u / 0.12)
    const beat = u / 0.12 - n
    const thrust = beat < 0.35 ? beat / 0.35 : 1 - (beat - 0.35) / 0.65
    copyPose(out, STANCE)
    out.spin = (u / 2.3) * 3 * TAU
    out.gx = -0.14
    out.gz = 0.1 + 0.55 * thrust
    out.gy = 1.15 + ((n % 3) - 1) * 0.12
    out.yaw = (n % 2 === 0 ? 0.35 : -0.35) * (1 - thrust * 0.5)
    out.pitch = ((n % 3) - 1) * 0.15
    out.lean = 0.2 + 0.15 * thrust
    out.twist = 0.2 * thrust - 0.1
    out.crouch = -0.12
    out.stance = 1
    return out
  }
  if (t < 2.95) {
    copyPose(scratch, STANCE)
    scratch.spin = 3 * TAU
    return mixPose(out, scratch, RAISE_HIGH, smoothstep(0, 1, (t - 2.6) / 0.35))
  }
  if (t < 3.1) return mixPose(out, RAISE_HIGH, FINAL, easeOutCubic((t - 2.95) / 0.15))
  if (t < 3.35) return copyPose(out, FINAL)
  copyPose(scratch, STANCE)
  scratch.spin = 3 * TAU
  return mixPose(out, FINAL, scratch, smoothstep(0, 1, (t - 3.35) / 0.25))
}

export function movePose(id: MoveId, t: number, out: Pose): Pose {
  if (id === 'MUSOU') return musouPose(t, out)
  return sample(ANIMS[id], t, out)
}
