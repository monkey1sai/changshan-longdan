export type DifficultyId = 'beginner' | 'normal' | 'hard' | 'chaos'

export interface DifficultyProfile {
  id: DifficultyId
  name: string
  enemyDamage: number
  /** Multiplier for the telegraphed attack duration; normal preserves the original timing. */
  windup: number
  captainHp: number
  maxAttackers: number
  engageRange: number
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyProfile> = {
  beginner: { id: 'beginner', name: '初級', enemyDamage: 0.65, captainHp: 0.75, windup: 1.25, maxAttackers: 2, engageRange: 22 },
  normal: { id: 'normal', name: '普通', enemyDamage: 1, captainHp: 1, windup: 1, maxAttackers: 4, engageRange: 26 },
  hard: { id: 'hard', name: '上級', enemyDamage: 1.25, captainHp: 1.35, windup: 0.9, maxAttackers: 5, engageRange: 30 },
  chaos: { id: 'chaos', name: '修羅', enemyDamage: 1.55, captainHp: 1.7, windup: 0.8, maxAttackers: 6, engageRange: 34 },
}
