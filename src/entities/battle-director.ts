import type { DifficultyProfile } from '../core/difficulty.ts'

export interface BattlePhase {
  id: 'opening' | 'pressure' | 'surge' | 'finale'
  minKo: number
  engageBonus: number
  attackerBonus: number
}

const PHASES: BattlePhase[] = [
  { id: 'opening', minKo: 0, engageBonus: 0, attackerBonus: 0 },
  { id: 'pressure', minKo: 60, engageBonus: 4, attackerBonus: 0 },
  { id: 'surge', minKo: 150, engageBonus: 8, attackerBonus: 1 },
  { id: 'finale', minKo: 240, engageBonus: 12, attackerBonus: 2 },
]

export interface BattlePressure {
  phase: BattlePhase
  engageRange: number
  maxAttackers: number
}

export class BattleDirector {
  private current = PHASES[0]

  reset(): void {
    this.current = PHASES[0]
  }

  update(ko: number, difficulty: DifficultyProfile): BattlePressure {
    let phase = PHASES[0]
    for (const candidate of PHASES) if (ko >= candidate.minKo) phase = candidate
    this.current = phase
    return {
      phase,
      engageRange: difficulty.engageRange + phase.engageBonus,
      maxAttackers: difficulty.maxAttackers + phase.attackerBonus,
    }
  }

  get phase(): BattlePhase {
    return this.current
  }
}
