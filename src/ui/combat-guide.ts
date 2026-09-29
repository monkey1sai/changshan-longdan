import { MOVES, type MoveId } from '../combat/moves.ts'
import type { PlayerState } from '../entities/player.ts'

const PURPOSE: Record<MoveId, string> = {
  N1: '直刺起手', N2: '橫掃前方', N3: '回身掃擊', N4: '雙重突刺', N5: '旋槍清兵', N6: '貫穿擊飛',
  C1: '挑起敵兵', C2: '挑空追擊', C3: '空中連打', C4: '迴旋清兵', C5: '集中破甲', C6: '大範圍震飛',
  JA: '俯衝落地', JC: '空中橫掃', MUSOU: '移動帶龍入陣', DASH: '突進破陣', COUNTER: '反擊震飛',
}

export function combatGuide(state: PlayerState, moveId: MoveId | null, counterReady: number): string {
  if (state === 'dead') return '趙雲敗走 · 結算後按 Enter 再戰'
  if (state === 'down' || state === 'hurt') return '受擊中 · 待起身後閃避脫離敵陣'
  if (state === 'musou') return '蒼龍破陣 · 移動將敵兵捲入龍膽亂舞'
  if ((state === 'guard' || state === 'move') && counterReady > 0) return '精準格擋！ J／□ 反擊震飛'
  if (state === 'guard') return counterReady > 0 ? '精準格擋！ J／□ 反擊震飛' : '正面防禦 · 迎擊瞬間按 F／L1 可反擊'
  if (state === 'dodge') return 'J／□ 接突進斬 · 迅速切入敵陣'
  if (state === 'jump') return 'J／□ 俯衝落地 · K／△ 空中橫掃'
  if (moveId?.startsWith('N')) {
    const charge = `C${Math.min(6, Number(moveId.slice(1)) + 1)}` as MoveId
    return `K／△ ${MOVES[charge].name} · ${PURPOSE[charge]}`
  }
  if (moveId !== null) return `${PURPOSE[moveId]} · Shift／R1 閃避銜接`
  return '按住 J／□ 連段 · K／△ 挑空 · Shift → J 突進'
}
