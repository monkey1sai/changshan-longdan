import type { MoveId } from './moves.ts'

export type ChargeButton = 'attack' | 'charge'

export interface ComboContext {
  current: MoveId | null // 正在出的招；null 表示可自由行動
  normalCount: number // 這串連段已出幾下普攻（N1 = 1 … N6 = 6）
  airborne: boolean
  canChain: boolean // 是否已過可接招時間
}

/**
 * 無雙系連段規則：普攻 N1→N6 依序接；在 Nk 之後按蓄力出 C(k+1)，最多 C6；
 * 空中只能出一次跳擊（JA）或跳躍蓄力（JC）。回傳 null 表示這次按鍵不接招。
 */
export function nextMove(ctx: ComboContext, button: ChargeButton): MoveId | null {
  if (ctx.current === 'MUSOU') return null
  if (ctx.airborne) {
    if (ctx.current !== null) return null
    return button === 'attack' ? 'JA' : 'JC'
  }
  if (ctx.current === null) return button === 'attack' ? 'N1' : 'C1'
  if (!ctx.canChain) return null
  if (ctx.current.startsWith('N')) {
    const n = ctx.normalCount
    if (button === 'attack') return n < 6 ? normal(n + 1) : null
    return n <= 5 ? charge(n + 1) : null
  }
  // 蓄力或空中招式收招後，可直接起新的一串
  return button === 'attack' ? 'N1' : 'C1'
}

function normal(n: number): MoveId {
  return `N${n}` as MoveId
}

function charge(n: number): MoveId {
  return `C${n}` as MoveId
}
