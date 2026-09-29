import { Color } from 'three'
import { PlayerModel, type PlayerVisualOptions } from '../view/player-model.ts'
import { SoldierView } from '../view/soldier-view.ts'
import { Fragments } from '../fx/fragments.ts'
import { Sparks } from '../fx/sparks.ts'
import { Dust } from '../fx/dust.ts'
import { Trail } from '../fx/trail.ts'
import { ThreatMarkers } from '../fx/threat-markers.ts'
import { Shockwaves } from '../fx/shockwave.ts'
import { Dragon, type DragonVisualOptions } from '../fx/dragon.ts'
import { buildCastle } from '../world/castle.ts'
import { buildManor } from '../world/manor.ts'
import { createGroundTexture } from '../world/textures.ts'
import { LONGDAN_SPEAR, ZHAOYUN } from './character.ts'
import { SPEAR_ANIMATION } from './player-animation.ts'
import { applyMaterials, ModelSlot, type ModelAsset } from './model.ts'
import type { EnemyVisualOptions } from './enemy.ts'
import type { AssetPack, EffectViews } from './pack.ts'

export interface PackOptions {
  id?: string
  player?: Partial<PlayerVisualOptions>
  enemies?: EnemyVisualOptions
  worlds?: { fortress?: ModelAsset; manor?: ModelAsset }
  /** Apply to procedural materials too; '*' is the pack-wide fallback. */
  materials?: ModelAsset['materials']
  dragon?: DragonVisualOptions
  effects?: Partial<{ [K in keyof EffectViews]: (capacity: number) => EffectViews[K] }>
}
/** One composition root. Change paths/config here without editing the game loop. */
export function createAssetPack(options: PackOptions = {}): AssetPack {
  return {
    id: options.id ?? 'longdan-default',
    createPlayer: () => {
      const view = new PlayerModel({ character: ZHAOYUN, weapon: LONGDAN_SPEAR, animation: SPEAR_ANIMATION, ...options.player })
      applyMaterials(view.group, options.materials)
      return view
    },
    createEnemies: (capacity) => {
      const view = new SoldierView(capacity, options.enemies)
      applyMaterials(view.group, options.materials)
      return view
    },
    createEffects: (capacity) => ({
      fragments: options.effects?.fragments?.(capacity) ?? new Fragments(),
      sparks: options.effects?.sparks?.(capacity) ?? new Sparks(),
      dust: options.effects?.dust?.(capacity) ?? new Dust(),
      trail: options.effects?.trail?.(capacity) ?? new Trail(),
      threats: options.effects?.threats?.(capacity) ?? new ThreatMarkers(capacity),
      waves: options.effects?.waves?.(capacity) ?? new Shockwaves(),
      dragon: options.effects?.dragon?.(capacity) ?? new Dragon(options.dragon),
    }),
    createFortress: () => {
      const world = buildCastle(createGroundTexture())
      applyMaterials(world.group, options.materials)
      const slot = new ModelSlot(world.group, options.worlds?.fortress)
      return { ...world, group: slot.group, slot }
    },
    createManor: () => {
      const world = buildManor()
      applyMaterials(world.group, options.materials)
      const slot = new ModelSlot(world.group, options.worlds?.manor)
      return { ...world, group: slot.group, slot }
    },
    colors: { shock: new Color(3.2, 2.2, 1.2), gold: new Color(5, 3.4, 1.1), white: new Color(6, 6, 5) },
  }
}
