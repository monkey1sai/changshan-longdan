import type { Color, Group } from 'three'
import type { PlayerModel } from '../view/player-model.ts'
import type { SoldierView } from '../view/soldier-view.ts'
import type { Fragments } from '../fx/fragments.ts'
import type { Sparks } from '../fx/sparks.ts'
import type { Dust } from '../fx/dust.ts'
import type { Trail } from '../fx/trail.ts'
import type { ThreatMarkers } from '../fx/threat-markers.ts'
import type { Shockwaves } from '../fx/shockwave.ts'
import type { Dragon } from '../fx/dragon.ts'
import type { CastleBuild } from '../world/castle.ts'
import type { ManorBuild } from '../world/manor.ts'
import type { ModelSlot } from './model.ts'

/** Public structural contracts: adapters need not inherit concrete view classes. */
type View<T> = Pick<T, keyof T>
export interface EffectViews {
  fragments: View<Fragments>
  sparks: View<Sparks>
  dust: View<Dust>
  trail: View<Trail>
  threats: View<ThreatMarkers>
  waves: View<Shockwaves>
  dragon: View<Dragon>
}
export interface AssetPack {
  id: string
  createPlayer(): View<PlayerModel>
  createEnemies(capacity: number): View<SoldierView>
  createEffects(capacity: number): EffectViews
  createFortress(): CastleBuild & { slot: ModelSlot }
  createManor(): ManorBuild & { slot: ModelSlot }
  colors: { shock: Color; gold: Color; white: Color }
}
export type SceneVisual = { group: Group; slot: ModelSlot }
