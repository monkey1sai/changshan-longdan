import type { MoveId } from '../combat/moves.ts'
import type { PlayerState } from '../entities/player.ts'
import { moveName, t, type TranslationKey } from './i18n.ts'

function purpose(id: MoveId): string {
  return t(`purpose.${id}` as TranslationKey)
}

export function combatGuide(state: PlayerState, moveId: MoveId | null, counterReady: number): string {
  if (state === 'dead') return t('guide.dead')
  if (state === 'down' || state === 'hurt') return t('guide.hurt')
  if (state === 'musou') return t('guide.musou')
  if ((state === 'guard' || state === 'move') && counterReady > 0) return t('guide.counter')
  if (state === 'guard') return t('guide.guard')
  if (state === 'dodge') return t('guide.dodge')
  if (state === 'jump') return t('guide.jump')
  if (moveId?.startsWith('N')) {
    const charge = `C${Math.min(6, Number(moveId.slice(1)) + 1)}` as MoveId
    return t('guide.normalCharge', { move: moveName(charge), purpose: purpose(charge) })
  }
  if (moveId !== null) return t('guide.followUp', { purpose: purpose(moveId) })
  return t('guide.move')
}
