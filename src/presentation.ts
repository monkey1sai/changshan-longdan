import { Color, Vector3, type Vector3Like } from 'three'
import type { AudioEngine } from './audio/audio-engine.ts'
import type { HitFx } from './combat/moves.ts'
import { clamp } from './core/math.ts'
import type { BattleEvent, PlayerView } from './entities/battle.ts'
import type { HitInfo, KillInfo } from './entities/enemies.ts'
import type { Dragon } from './fx/dragon.ts'
import type { Dust } from './fx/dust.ts'
import type { Fragments } from './fx/fragments.ts'
import type { Shockwaves } from './fx/shockwave.ts'
import type { Sparks } from './fx/sparks.ts'
import type { PostSettings } from './render/pipeline.ts'
import type { Hud } from './ui/hud.ts'
import { t, translate } from './ui/i18n.ts'

/** 戰鬥中的音樂音量；無雙結束後回到這個值。 */
export const MUSIC_LEVEL = 0.42
const SHOCK = new Color(3.2, 2.2, 1.2)
const GOLD = new Color(5, 3.4, 1.1)
const WHITE = new Color(6, 6, 5)

export type AudioSink = Pick<AudioEngine, 'swing' | 'jump' | 'land' | 'dodge' | 'hit' | 'shatter' | 'enemySwing' | 'playerHurt' |
  'musouStart' | 'dragonRoar' | 'musouBlast' | 'musouReady' | 'milestone' | 'victory' | 'defeat' | 'setMusicLevel'>

/** 鏡頭：震動，以及依聲源在鏡頭左右的位置決定聲道。 */
export interface CameraSink {
  addTrauma(amount: number): void
  kick(amount: number): void
  readonly right: Vector3Like
  readonly camera: { readonly position: Vector3Like }
}

/** Presentation 驅動的輸出端；每個只開放它會呼叫的方法。 */
export interface PresentationSinks {
  /** 音效引擎在第一次使用者手勢後才建立，之前回傳 null。 */
  audio: () => AudioSink | null
  sparks: Pick<Sparks, 'burst' | 'glitter'>
  dust: Pick<Dust, 'puff' | 'ring'>
  waves: Pick<Shockwaves, 'ring' | 'pillar'>
  fragments: Pick<Fragments, 'spawnSoldier'>
  camera: CameraSink
  post: Pick<PostSettings, 'aberration' | 'radial' | 'flash'>
  hud: Pick<Hud, 'showBanner' | 'playCutin'>
  /** 畫面上的蒼龍，用來在龍身上取金色光點的位置。 */
  dragon: Pick<Dragon, 'randomPoint'>
  rng: () => number
}

/** 事件引用的戰鬥資料：命中與擊破緩衝區、趙雲位置與朝向。 */
export interface PresentationSource {
  readonly hits: readonly HitInfo[]
  readonly kills: readonly KillInfo[]
  readonly player: Pick<PlayerView, 'pos' | 'facing'>
}

/** 把戰鬥事件轉成音效、特效、鏡頭與 HUD；不改變戰鬥本身。 */
export class Presentation {
  private readonly sinks: PresentationSinks
  private readonly tmp = new Vector3()
  private roarsPlayed = 0
  private wasMusou = false

  constructor(sinks: PresentationSinks) {
    this.sinks = sinks
  }

  /** 新的一場戰鬥開始。 */
  reset(): void {
    this.roarsPlayed = 0
    this.wasMusou = false
  }

  /** 播放一次 step 產生的事件。 */
  play(events: readonly BattleEvent[], battle: PresentationSource): void {
    const { sparks, dust, waves, fragments, camera, post, hud, rng } = this.sinks
    const audio = this.sinks.audio()
    const p = battle.player.pos
    for (const e of events) {
      switch (e.type) {
        case 'swing':
          audio?.swing(e.heavy)
          break
        case 'jump':
          audio?.jump()
          break
        case 'land':
          audio?.land(e.heavy)
          dust.puff(p.x, 0, p.z, e.heavy ? 16 : 8, e.heavy ? 5 : 3, rng)
          if (e.heavy) camera.addTrauma(0.15)
          break
        case 'dodge':
          audio?.dodge()
          dust.puff(p.x, 0, p.z, 6, 2.5, rng)
          break
        case 'musouStart':
          this.roarsPlayed = 0
          hud.playCutin()
          audio?.musouStart()
          audio?.setMusicLevel(0.14, 0.2)
          camera.addTrauma(0.35)
          post.radial = 1
          break
        case 'fx':
          this.groundFx(e.fx, e.x, e.z, e.radius, battle.player.facing)
          break
        case 'hit': {
          const win = e.window
          const heavy = win.sfx === 'heavy'
          camera.addTrauma(win.shake * (e.count > 3 ? 1.15 : 1))
          if (heavy) {
            camera.kick(0.5)
            post.aberration = Math.max(post.aberration, 0.8)
          }
          for (let i = e.start; i < e.start + e.count; i++) {
            const h = battle.hits[i]
            sparks.burst(h.x, h.y + 1.1, h.z, h.dirX, h.dirZ, heavy ? 12 : 7, heavy, rng)
          }
          const first = battle.hits[e.start]
          audio?.hit(win.sfx, e.count, this.pan(first.x, first.z))
          break
        }
        case 'dragonHit':
          for (let i = e.start; i < e.start + e.count; i++) {
            const h = battle.hits[i]
            sparks.burst(h.x, h.y + 1.1, h.z, h.dirX, h.dirZ, 6, false, rng)
          }
          audio?.hit('light', e.count, this.pan(e.x, e.z))
          break
        case 'kill': {
          for (let i = e.start; i < e.start + e.count; i++) {
            const k = battle.kills[i]
            fragments.spawnSoldier(k, rng)
            dust.puff(k.x, 0, k.z, 3, 2.5, rng)
          }
          const first = battle.kills[e.start]
          audio?.shatter(e.count, this.pan(first.x, first.z))
          break
        }
        case 'milestone': {
          const ko = e.ko
          hud.showBanner(() => translate(`${ko} 人斬！`, `${ko} KOs!`), 2, 'gold')
          audio?.milestone()
          break
        }
        case 'halfDefeated':
          hud.showBanner(() => translate('魏軍 半數潰滅', 'Half the Wei Army Defeated'), 2)
          break
        case 'phase': {
          const id = e.id
          hud.showBanner(() => t(`battle.${id}`), 2)
          break
        }
        case 'enemyStrike':
          audio?.enemySwing(this.pan(e.x, e.z))
          break
        case 'parry':
        case 'guardBlock': {
          const perfect = e.type === 'parry'
          const facing = e.facing
          audio?.hit('pierce', 1, this.pan(e.x, e.z))
          sparks.burst(p.x, p.y + 1.2, p.z, Math.sin(facing), Math.cos(facing), perfect ? 18 : 6, perfect, rng)
          camera.addTrauma(perfect ? 0.12 : 0.04)
          if (perfect) waves.ring(p.x, p.z, 2.4, 0.3, WHITE)
          break
        }
        case 'hurt': {
          audio?.playerHurt(e.heavy)
          camera.addTrauma(e.heavy ? 0.45 : 0.25)
          const dx = p.x - e.x
          const dz = p.z - e.z
          const d = Math.hypot(dx, dz) || 1
          sparks.burst(p.x, p.y + 1.2, p.z, dx / d, dz / d, 6, e.heavy, rng)
          break
        }
        case 'musouReady':
          audio?.musouReady()
          hud.showBanner(() => translate('龍膽 就緒', 'Longdan Ready'), 1.4, 'gold')
          break
        case 'victory':
          hud.showBanner(() => translate('完全勝利', 'Complete Victory'), 3, 'gold')
          audio?.victory()
          audio?.setMusicLevel(0.2)
          break
        case 'defeat':
          hud.showBanner(() => translate('趙雲 敗走…', 'Zhao Yun Has Fallen…'), 3)
          audio?.defeat()
          audio?.setMusicLevel(0.12)
          break
        default:
          break
      }
    }
  }

  /** 蒼龍在畫面上時，每次遊戲時間前進呼叫一次：龍吼與龍身金色光點。 */
  dragonFrame(strike: { readonly active: boolean; readonly elapsed: number }): void {
    const t = strike.elapsed
    if (strike.active && ((this.roarsPlayed === 0 && t > 0.35) || (this.roarsPlayed === 1 && t > 2.75))) {
      this.sinks.audio()?.dragonRoar()
      this.roarsPlayed++
    }
    const { sparks, dragon, rng } = this.sinks
    for (let i = 0; i < 5; i++) {
      dragon.randomPoint(rng, this.tmp)
      sparks.glitter(this.tmp.x, this.tmp.y, this.tmp.z, 4.5, 3.2, 1, rng)
    }
  }

  /** 每幀回報趙雲是否在無雙中；無雙結束且戰鬥仍在進行時恢復音樂音量。 */
  musouState(musou: boolean, playing: boolean): void {
    if (this.wasMusou && !musou && playing) this.sinks.audio()?.setMusicLevel(MUSIC_LEVEL, 1)
    this.wasMusou = musou
  }

  private groundFx(fx: HitFx, x: number, z: number, radius: number, facing: number): void {
    const { waves, dust, camera, post, rng } = this.sinks
    if (fx === 'shockwave') {
      waves.ring(x, z, radius * 1.1, 0.45, SHOCK)
      dust.ring(x, z, radius, 26, rng)
      camera.addTrauma(0.3)
      post.radial = Math.max(post.radial, 0.5)
      return
    }
    // 無雙收尾：龍在趙雲前方 6 公尺撞地
    const fxX = x + Math.sin(facing) * 6
    const fxZ = z + Math.cos(facing) * 6
    waves.ring(fxX, fxZ, 12, 0.8, GOLD)
    waves.ring(fxX, fxZ, 6, 0.5, WHITE)
    waves.pillar(fxX, fxZ, 3, 34, 0.9, GOLD)
    dust.ring(fxX, fxZ, 9, 56, rng)
    this.sinks.audio()?.musouBlast()
    post.flash = 0.5
    post.radial = 1
    camera.addTrauma(1)
    camera.kick(1)
  }

  /** 依聲源在鏡頭左右的位置決定聲道。 */
  private pan(x: number, z: number): number {
    const { camera } = this.sinks
    const cam = camera.camera.position
    return clamp(((x - cam.x) * camera.right.x + (z - cam.z) * camera.right.z) / 12, -1, 1) * 0.7
  }
}
