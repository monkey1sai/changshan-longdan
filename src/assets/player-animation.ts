import type { Player } from '../entities/player.ts'
import { smoothstep, TAU } from '../core/math.ts'
import { AIR, copyPose, DOWN, GUARD, HURT, mixPose, movePose, ROLL, RUN, STANCE, type Pose } from '../view/player-poses.ts'

/** Sample game time. Animations never decide hit windows, damage or root movement. */
export interface PlayerAnimation { sample(player: Readonly<Player>, out: Pose): void }
export const SPEAR_ANIMATION: PlayerAnimation = {
  sample(player, t) {
    copyPose(t, STANCE)
    switch (player.state) {
      case 'move': {
        const run = smoothstep(.3, 6.5, player.speed)
        mixPose(t, STANCE, RUN, run)
        t.crouch += Math.sin(player.runPhase * 2) * .035 * run
        break
      }
      case 'jump': copyPose(t, AIR); break
      case 'guard': copyPose(t, GUARD); break
      case 'attack':
      case 'musou': if (player.move) movePose(player.move.id, player.moveTime, t); break
      case 'dodge':
        if (player.dodgeBack) { copyPose(t, HURT); t.lean = -.15 }
        else { copyPose(t, ROLL); t.flip = TAU * smoothstep(.02, .36, player.stateTime); t.lean = .9; t.crouch = -.35 }
        break
      case 'hurt': copyPose(t, HURT); break
      case 'down': mixPose(t, DOWN, STANCE, smoothstep(.95, 1.3, player.stateTime)); break
      case 'dead': copyPose(t, DOWN); break
    }
  },
}
