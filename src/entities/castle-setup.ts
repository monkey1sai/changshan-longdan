import { createRng } from '../core/math.ts'
import { obstacles, PLAY_LIMIT, PLAYER_START, SQUADS } from '../world/layout.ts'
import { Arena } from './arena.ts'
import type { BattleSetup } from './battle.ts'
import { squadSpawns } from './enemies.ts'

/** 正式戰場可容納的魏兵數（畫面的 instanced mesh 也依此配置）。 */
export const CASTLE_CAPACITY = 320

/** 正式戰場：城內的障礙物、各隊魏兵與趙雲起點。 */
export function castleSetup(): BattleSetup {
  return {
    arena: new Arena(PLAY_LIMIT, obstacles()),
    spawns: () => squadSpawns(SQUADS, createRng(7)),
    playerStart: PLAYER_START,
    capacity: CASTLE_CAPACITY,
  }
}
