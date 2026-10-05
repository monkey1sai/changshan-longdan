import { Color, FogExp2, PMREMGenerator, Scene, Vector2, Vector3, type Mesh } from 'three'
import { AudioEngine } from './audio/audio-engine.ts'
import { Music } from './audio/music.ts'
import type { HitFx } from './combat/moves.ts'
import { Input, type InputFrame } from './core/input.ts'
import { clamp, createRng, damp } from './core/math.ts'
import type { DifficultyId } from './core/difficulty.ts'
import { Battle, type BattleEvent } from './entities/battle.ts'
import { castleSetup } from './entities/castle-setup.ts'
import { MUSOU_MAX, type PlayerControls } from './entities/player.ts'
import { Dragon } from './fx/dragon.ts'
import { Dust } from './fx/dust.ts'
import { Fragments } from './fx/fragments.ts'
import { Shockwaves } from './fx/shockwave.ts'
import { Sparks } from './fx/sparks.ts'
import { Trail } from './fx/trail.ts'
import { ThreatMarkers } from './fx/threat-markers.ts'
import { Pipeline, type PostSettings } from './render/pipeline.ts'
import { Hud } from './ui/hud.ts'
import { t, translate } from './ui/i18n.ts'
import { Screens } from './ui/screens.ts'
import { CameraRig, toPlayerControls } from './view/camera-rig.ts'
import { updateRoofCutaway } from './view/roof-cutaway.ts'
import { PlayerModel } from './view/player-model.ts'
import { SoldierView } from './view/soldier-view.ts'
import { buildCastle } from './world/castle.ts'
import { FireField, type FireSource } from './world/fire.ts'
import { Flags } from './world/flags.ts'
import { BIG_FIRES, BRAZIERS, PLAYER_START } from './world/layout.ts'
import { Lighting } from './world/lights.ts'
import { Sky } from './world/sky.ts'
import { createFlagTexture, createGroundTexture } from './world/textures.ts'

type Mode = 'title' | 'playing' | 'paused' | 'ended'

const MUSIC_LEVEL = 0.42
const SHOCK = new Color(3.2, 2.2, 1.2)
const GOLD = new Color(5, 3.4, 1.1)
const WHITE = new Color(6, 6, 5)

/** 遊戲主體：擁有場景、所有系統與主迴圈。 */
export class Game {
  private readonly pipeline: Pipeline
  private readonly scene = new Scene()
  private readonly rig: CameraRig
  private readonly barracksRoofs: Mesh[]
  private readonly input: Input
  private readonly battle = new Battle(castleSetup())
  private difficulty: DifficultyId = 'normal'
  private readonly model = new PlayerModel()
  private readonly soldiers = new SoldierView(this.battle.enemies.capacity)
  private readonly fragments = new Fragments()
  private readonly sparks = new Sparks()
  private readonly dust = new Dust()
  private readonly trail = new Trail()
  private readonly threats = new ThreatMarkers(this.battle.enemies.capacity)
  private readonly waves = new Shockwaves()
  private readonly dragon = new Dragon()
  private readonly sky = new Sky()
  private readonly flags: Flags
  private readonly fire: FireField
  private readonly lighting: Lighting
  private readonly hud = new Hud()
  private readonly screens = new Screens()
  private readonly rng = createRng(99)
  private readonly post: PostSettings = { focus: 9, musou: 0, flash: 0, aberration: 0, radial: 0, danger: 0, bars: 0, exposure: 1, dof: 0.8 }
  private readonly tmp = new Vector3()
  private readonly controls: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }
  private audio: AudioEngine | null = null
  private music: Music | null = null
  private mode: Mode = 'title'
  private last = 0
  private clock = 0 // 真實時間
  private simClock = 0 // 遊戲時間（命中停頓時暫停）
  private endTimer = 0
  private resultShown = false
  private roarsPlayed = 0
  private wasMusou = false
  private frameAvg = 1 / 60
  private qualityTimer = 0
  private minimapTick = 0
  private readonly perf = document.getElementById('perf')

  constructor(canvas: HTMLCanvasElement) {
    this.pipeline = new Pipeline(canvas)
    this.rig = new CameraRig(window.innerWidth / window.innerHeight)
    this.input = new Input(window, canvas, () => this.mode === 'title')

    const castle = buildCastle(createGroundTexture())
    this.barracksRoofs = castle.barracksRoofs
    this.scene.add(castle.group, this.sky.mesh)
    this.scene.fog = new FogExp2(new Color(0.38, 0.27, 0.27), 0.0045)
    this.flags = new Flags(castle.flags, createFlagTexture())
    const fires: FireSource[] = [...BRAZIERS.map((b) => ({ x: b.x, y: 1.3, z: b.z, scale: 0.55 })), ...BIG_FIRES, ...castle.fires]
    this.fire = new FireField(fires)
    this.lighting = new Lighting(this.scene, fires)
    this.scene.add(this.flags.mesh, this.fire.group)

    // 以天空產生環境光照，讓金屬盔甲映出夕陽
    const pmrem = new PMREMGenerator(this.pipeline.renderer)
    const skyScene = new Scene()
    skyScene.add(new Sky().mesh)
    this.scene.environment = pmrem.fromScene(skyScene, 0.04).texture
    this.scene.environmentIntensity = 0.55
    pmrem.dispose()

    this.scene.add(
      this.model.group,
      this.soldiers.group,
      this.fragments.mesh,
      this.sparks.mesh,
      this.dust.points,
      this.trail.mesh,
      this.threats.mesh,
      this.waves.group,
      this.dragon.group,
    )

    window.addEventListener('resize', () => this.resize())
    window.addEventListener('blur', () => this.setPaused(true))
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.setPaused(true)
    })
    this.resize()
    // 瀏覽器規定音訊必須在使用者互動後才能播放
    const unlock = () => this.ensureAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    this.screens.onStart(() => this.startBattle())
    this.screens.onRetry(() => this.startBattle())
    this.screens.onResume(() => this.setPaused(false))

    this.resetPresentation()
    this.rig.snap(this.battle.player.pos, PLAYER_START.facing)
    if (import.meta.env.DEV) this.exposeDebug()
  }

  start(): void {
    requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame)
    const frameDt = this.last === 0 ? 1 / 60 : (now - this.last) / 1000
    const realDt = Math.min(0.05, frameDt)
    this.last = now
    this.tick(realDt, this.input.poll(realDt), true)
    if (!document.hidden && frameDt < 0.25) this.trackPerformance(frameDt)
  }

  private tick(realDt: number, input: InputFrame, render: boolean): void {
    this.clock += realDt
    this.handleModeInput(input)
    const simDt = this.mode === 'playing' || this.mode === 'ended' ? this.simulate(realDt, input) : 0
    this.simClock += simDt
    this.updateVisuals(realDt, simDt, input)
    if (render) this.pipeline.render(this.scene, this.rig.camera, this.post, this.clock)
  }

  private ensureAudio(): void {
    if (this.audio === null) {
      this.audio = new AudioEngine()
      this.music = new Music(this.audio.ctx, this.audio.musicBus)
      this.music.start(this.mode === 'title' ? 'title' : 'battle')
      this.audio.startAmbience()
    }
    void this.audio.resume()
  }

  private startBattle(): void {
    if (this.mode === 'title') this.difficulty = this.screens.selectedDifficulty()
    this.ensureAudio()
    this.resetBattle()
    this.mode = 'playing'
    this.screens.showTitle(false)
    this.screens.showPause(false)
    this.screens.hideResult()
    this.hud.setVisible(true)
    this.rig.snap(this.battle.player.pos, PLAYER_START.facing)
    this.music?.setMode('battle')
    this.audio?.setMusicLevel(MUSIC_LEVEL)
    this.audio?.uiConfirm()
    this.hud.showBanner(() => translate('出陣！', 'To Battle!'), 2)
  }

  private resetBattle(): void {
    this.battle.reset(this.difficulty)
    this.resetPresentation()
  }

  /** 清掉上一局的畫面狀態；Battle 建構時已重置過，開機時只需要這一步。 */
  private resetPresentation(): void {
    this.soldiers.applyColors(this.battle.enemies, createRng(8))
    this.fragments.clear()
    this.sparks.clear()
    this.dust.clear()
    this.trail.clear()
    this.waves.clear()
    this.dragon.stop()
    this.model.resetCape()
    this.endTimer = 0
    this.resultShown = false
    this.wasMusou = false
    Object.assign(this.post, { musou: 0, flash: 0, aberration: 0, radial: 0, danger: 0, bars: 0 })
  }

  private setPaused(paused: boolean): void {
    if (paused && this.mode !== 'playing') return
    if (!paused && this.mode !== 'paused') return
    this.mode = paused ? 'paused' : 'playing'
    this.input.clear()
    this.battle.interrupt()
    this.screens.showPause(paused)
    this.audio?.setMusicLevel(paused ? 0.12 : MUSIC_LEVEL)
  }

  private handleModeInput(input: InputFrame): void {
    if (input.debug && this.perf !== null) this.perf.hidden = !this.perf.hidden
    switch (this.mode) {
      case 'title':
        if (input.confirm || input.attack) this.startBattle()
        break
      case 'playing':
        if (input.pause) this.setPaused(true)
        break
      case 'paused':
        if (input.pause || input.confirm) this.setPaused(false)
        break
      case 'ended':
        if (this.resultShown && input.confirm) this.startBattle()
        break
    }
  }

  /** 推進一幀戰鬥並呈現其結果，回傳實際推進的遊戲時間（命中停頓時為 0）。 */
  private simulate(realDt: number, input: InputFrame): number {
    toPlayerControls(input, this.rig.forward, this.rig.right, this.controls)
    if (this.mode === 'playing' && input.recenter) this.rig.recenter(this.battle.player.facing)
    const dt = this.battle.step(realDt, this.controls)
    if (this.mode === 'ended') this.showResultLater(realDt)
    this.present(this.battle.events)
    if (dt > 0) this.updateDragon()
    return dt
  }

  /** 把戰鬥事件轉成音效、特效、鏡頭與 HUD。 */
  private present(events: readonly BattleEvent[]): void {
    const b = this.battle
    const p = b.player.pos
    for (const e of events) {
      switch (e.type) {
        case 'swing':
          this.audio?.swing(e.heavy)
          break
        case 'jump':
          this.audio?.jump()
          break
        case 'land':
          this.audio?.land(e.heavy)
          this.dust.puff(p.x, 0, p.z, e.heavy ? 16 : 8, e.heavy ? 5 : 3, this.rng)
          if (e.heavy) this.rig.addTrauma(0.15)
          break
        case 'dodge':
          this.audio?.dodge()
          this.dust.puff(p.x, 0, p.z, 6, 2.5, this.rng)
          break
        case 'musouStart':
          this.beginMusou()
          break
        case 'fx':
          this.groundFx(e.fx, e.x, e.z, e.radius)
          break
        case 'hit': {
          const win = e.window
          const heavy = win.sfx === 'heavy'
          this.rig.addTrauma(win.shake * (e.count > 3 ? 1.15 : 1))
          if (heavy) {
            this.rig.kick(0.5)
            this.post.aberration = Math.max(this.post.aberration, 0.8)
          }
          for (let i = e.start; i < e.start + e.count; i++) {
            const h = b.hits[i]
            this.sparks.burst(h.x, h.y + 1.1, h.z, h.dirX, h.dirZ, heavy ? 12 : 7, heavy, this.rng)
          }
          const first = b.hits[e.start]
          this.audio?.hit(win.sfx, e.count, this.pan(first.x, first.z))
          break
        }
        case 'dragonHit':
          for (let i = e.start; i < e.start + e.count; i++) {
            const h = b.hits[i]
            this.sparks.burst(h.x, h.y + 1.1, h.z, h.dirX, h.dirZ, 6, false, this.rng)
          }
          this.audio?.hit('light', e.count, this.pan(e.x, e.z))
          break
        case 'kill': {
          for (let i = e.start; i < e.start + e.count; i++) {
            const k = b.kills[i]
            this.fragments.spawnSoldier(k, this.rng)
            this.dust.puff(k.x, 0, k.z, 3, 2.5, this.rng)
          }
          const first = b.kills[e.start]
          this.audio?.shatter(e.count, this.pan(first.x, first.z))
          break
        }
        case 'milestone': {
          const ko = e.ko
          this.hud.showBanner(() => translate(`${ko} 人斬！`, `${ko} KOs!`), 2, 'gold')
          this.audio?.milestone()
          break
        }
        case 'halfDefeated':
          this.hud.showBanner(() => translate('魏軍 半數潰滅', 'Half the Wei Army Defeated'), 2)
          break
        case 'phase': {
          const id = e.id
          this.hud.showBanner(() => t(`battle.${id}`), 2)
          break
        }
        case 'enemyStrike':
          this.audio?.enemySwing(this.pan(e.x, e.z))
          break
        case 'parry':
        case 'guardBlock': {
          const perfect = e.type === 'parry'
          const facing = e.facing
          this.audio?.hit('pierce', 1, this.pan(e.x, e.z))
          this.sparks.burst(p.x, p.y + 1.2, p.z, Math.sin(facing), Math.cos(facing), perfect ? 18 : 6, perfect, this.rng)
          this.rig.addTrauma(perfect ? 0.12 : 0.04)
          if (perfect) this.waves.ring(p.x, p.z, 2.4, 0.3, WHITE)
          break
        }
        case 'hurt': {
          this.audio?.playerHurt(e.heavy)
          this.rig.addTrauma(e.heavy ? 0.45 : 0.25)
          const dx = p.x - e.x
          const dz = p.z - e.z
          const d = Math.hypot(dx, dz) || 1
          this.sparks.burst(p.x, p.y + 1.2, p.z, dx / d, dz / d, 6, e.heavy, this.rng)
          break
        }
        case 'musouReady':
          this.audio?.musouReady()
          this.hud.showBanner(() => translate('龍膽 就緒', 'Longdan Ready'), 1.4, 'gold')
          break
        case 'victory':
          this.mode = 'ended'
          this.endTimer = 2.4
          this.hud.showBanner(() => translate('完全勝利', 'Complete Victory'), 3, 'gold')
          this.audio?.victory()
          this.audio?.setMusicLevel(0.2)
          break
        case 'defeat':
          this.mode = 'ended'
          this.endTimer = 2.4
          this.hud.showBanner(() => translate('趙雲 敗走…', 'Zhao Yun Has Fallen…'), 3)
          this.audio?.defeat()
          this.audio?.setMusicLevel(0.12)
          break
        default:
          break
      }
    }
  }

  private groundFx(fx: HitFx, x: number, z: number, radius: number): void {
    if (fx === 'shockwave') {
      this.waves.ring(x, z, radius * 1.1, 0.45, SHOCK)
      this.dust.ring(x, z, radius, 26, this.rng)
      this.rig.addTrauma(0.3)
      this.post.radial = Math.max(this.post.radial, 0.5)
      return
    }
    // 無雙收尾：龍在趙雲前方 6 公尺撞地
    const facing = this.battle.player.facing
    const fxX = x + Math.sin(facing) * 6
    const fxZ = z + Math.cos(facing) * 6
    this.waves.ring(fxX, fxZ, 12, 0.8, GOLD)
    this.waves.ring(fxX, fxZ, 6, 0.5, WHITE)
    this.waves.pillar(fxX, fxZ, 3, 34, 0.9, GOLD)
    this.dust.ring(fxX, fxZ, 9, 56, this.rng)
    this.audio?.musouBlast()
    this.post.flash = 0.5
    this.post.radial = 1
    this.rig.addTrauma(1)
    this.rig.kick(1)
  }

  private beginMusou(): void {
    this.roarsPlayed = 0
    this.hud.playCutin()
    this.audio?.musouStart()
    this.audio?.setMusicLevel(0.14, 0.2)
    this.rig.addTrauma(0.35)
    this.post.radial = 1
  }

  /** 遊戲時間前進時更新蒼龍畫面、龍吼與金色光點。 */
  private updateDragon(): void {
    const strike = this.battle.dragon
    if (!strike.active && !this.dragon.active) return
    this.dragon.update(strike)
    const t = strike.elapsed
    if (strike.active && ((this.roarsPlayed === 0 && t > 0.35) || (this.roarsPlayed === 1 && t > 2.75))) {
      this.audio?.dragonRoar()
      this.roarsPlayed++
    }
    for (let i = 0; i < 5; i++) {
      this.dragon.randomPoint(this.rng, this.tmp)
      this.sparks.glitter(this.tmp.x, this.tmp.y, this.tmp.z, 4.5, 3.2, 1, this.rng)
    }
  }

  /** 勝負分出後稍待片刻再顯示戰果。 */
  private showResultLater(realDt: number): void {
    this.endTimer -= realDt
    if (this.endTimer <= 0 && !this.resultShown) {
      this.resultShown = true
      this.screens.showResult(this.battle.result())
    }
  }

  private updateVisuals(realDt: number, simDt: number, input: InputFrame): void {
    const b = this.battle
    const player = b.player
    const musou = player.state === 'musou'
    if (this.wasMusou && !musou && this.mode === 'playing') this.audio?.setMusicLevel(MUSIC_LEVEL, 1)
    this.wasMusou = musou

    this.rig.update(realDt, player.pos, this.mode === 'playing' ? input.camTurn : 0, input.zoom, musou, this.mode === 'title', this.clock)
    updateRoofCutaway(this.barracksRoofs, player.pos.x, player.pos.z, this.mode === 'title')
    const p = this.post
    p.musou = damp(p.musou, musou ? 1 : 0, musou ? 12 : 4, realDt)
    p.bars = damp(p.bars, musou ? 1 : 0, 8, realDt)
    p.flash = damp(p.flash, 0, 9, realDt)
    p.aberration = damp(p.aberration, 0, 7, realDt)
    p.radial = damp(p.radial, 0, 5, realDt)
    const hpRatio = player.hp / player.maxHp
    const danger = this.mode === 'playing' && hpRatio < 0.3 ? (0.55 + 0.45 * Math.sin(this.clock * 5)) * (1 - hpRatio / 0.3 + 0.3) : 0
    p.danger = damp(p.danger, clamp(danger, 0, 1), 6, realDt)
    p.focus = this.rig.focusDistance
    p.dof = damp(p.dof, this.mode === 'title' ? 0.8 : 0.12, 5, realDt)

    const camera = this.rig.camera
    const sizeScale = this.pipeline.renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360))
    this.sky.update(camera, this.clock)
    this.flags.update(this.clock)
    this.fire.update(this.clock, this.rig.focus, sizeScale)
    this.lighting.update(this.rig.focus, this.clock)

    this.model.update(player, simDt, this.simClock)
    this.soldiers.update(b.enemies, this.clock)
    this.threats.update(b.enemies, this.simClock)
    this.fragments.update(simDt)
    this.sparks.update(simDt)
    this.dust.update(simDt, sizeScale)
    this.waves.update(simDt)
    this.updateTrail()

    if (this.mode !== 'title') {
      this.hud.update(
        {
          ko: b.ko,
          remain: b.enemies.aliveCount,
          hp: player.hp,
          maxHp: player.maxHp,
          musou: player.musou,
          musouReady: player.musouReady,
          combo: b.combo,
          comboTime: b.comboTime,
          moveId: player.move?.id ?? null,
          playerState: player.state,
          counterReady: player.counterReady,
        },
        realDt,
      )
      this.hud.updateOfficer(b.enemies, player.pos.x, player.pos.z)
      if (++this.minimapTick % 3 === 0) {
        this.hud.drawMinimap(b.enemies, player.pos.x, player.pos.z, player.facing, this.rig.yaw)
      }
    }
  }

  private updateTrail(): void {
    const p = this.battle.player
    const m = p.move
    let active = false
    if (m !== null && (p.state === 'attack' || p.state === 'musou')) {
      for (const [a, b] of m.trail) if (p.moveTime >= a && p.moveTime <= b) active = true
    }
    this.trail.setStyle(p.state === 'musou')
    if (active) this.trail.push(this.model.tipBase, this.model.tip, this.simClock)
    this.trail.update(this.simClock)
  }

  /** 依事件在鏡頭左右的位置決定聲道。 */
  private pan(x: number, z: number): number {
    const cam = this.rig.camera.position
    return clamp(((x - cam.x) * this.rig.right.x + (z - cam.z) * this.rig.right.z) / 12, -1, 1) * 0.7
  }

  private resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.pipeline.setSize(w, h)
    this.rig.camera.aspect = w / h
    this.rig.camera.updateProjectionMatrix()
  }

  /** 動態解析度：連續偏慢時降低渲染倍率，回穩後再慢慢拉回。 */
  private trackPerformance(dt: number): void {
    this.frameAvg = this.frameAvg * 0.95 + dt * 0.05
    this.qualityTimer += dt
    if (this.qualityTimer > 2) {
      this.qualityTimer = 0
      const q = this.pipeline.qualityScale
      if (this.frameAvg > 1 / 45 && q > 0.6) this.pipeline.setQuality(q - 0.15)
      else if (this.frameAvg < 1 / 57 && q < 1) this.pipeline.setQuality(q + 0.1)
    }
    if (this.perf !== null && !this.perf.hidden) {
      this.perf.textContent =
        `FPS ${Math.round(1 / this.frameAvg)} · draw ${this.pipeline.sceneDrawCalls} · ` +
        `tris ${Math.round(this.pipeline.sceneTriangles / 1000)}k · ${translate('存活', 'alive')} ${this.battle.enemies.aliveCount} · ` +
        `${translate('碎片', 'fragments')} ${this.fragments.active} · ${translate('解析度', 'scale')} ${this.pipeline.qualityScale.toFixed(2)}`
    }
  }

  /** 開發模式下提供給自動化驗證使用的除錯介面。 */
  private exposeDebug(): void {
    const game = this
    const battle = this.battle
    Object.assign(window, {
      __game: {
        get state() {
          return {
            mode: game.mode === 'ended' ? battle.outcome : game.mode,
            ko: battle.ko,
            alive: battle.enemies.aliveCount,
            hp: battle.player.hp,
            musou: battle.player.musou,
            playerState: battle.player.state,
            move: battle.player.move?.id ?? null,
            counterReady: battle.player.counterReady,
            facing: battle.player.facing,
            cameraYaw: game.rig.yaw,
            combo: battle.combo,
            damageTaken: battle.damageTaken,
            maxCombo: battle.maxCombo,
            fps: Math.round(1 / game.frameAvg),
            quality: game.pipeline.qualityScale,
            drawCalls: game.pipeline.sceneDrawCalls,
            triangles: game.pipeline.sceneTriangles,
            fragments: game.fragments.active,
            dragon: battle.dragon.active,
            position: [battle.player.pos.x, battle.player.pos.y, battle.player.pos.z],
            audio: game.audio?.ctx.state ?? 'none',
            character: game.model.assetStatus,
            animation: game.model.animationStatus,
            moveTime: battle.player.moveTime,
            stateTime: battle.player.stateTime,
            hitstop: battle.hitstop,
            playerEvents: battle.events.map(event => event.type),
            spearTip: game.model.tip.toArray(),
          }
        },
        start: () => game.startBattle(),
        fillMusou: () => battle.debug.setMusou(MUSOU_MAX),
        heal: () => battle.debug.setHp(battle.player.maxHp),
        setHp: (hp: number) => battle.debug.setHp(hp),
        setTimeScale: (scale: number) => {
          battle.timeScale = scale
        },
        /** 開發驗證：從指定方向送入單一敵方攻擊，沿用正式格擋／受傷／敗北流程。 */
        strike: (damage: number, heavy = false, fromX = battle.player.pos.x, fromZ = battle.player.pos.z - 2) => {
          if (game.mode !== 'playing') return
          battle.debug.injectStrike({ damage, heavy, x: fromX, z: fromZ })
          game.present(battle.events)
        },
        /**
         * 以固定 1/60 秒逐幀推進（分頁不可見、rAF 暫停時也能驗證）。
         * input 的按鍵只在第一幀按下；moveX、moveY、camTurn 每幀都套用。最後一幀才渲染。
         */
        advance: (frames = 1, input: Partial<InputFrame> = {}) => {
          const idle: InputFrame = {
            moveX: 0, moveY: 0, camTurn: 0, zoom: 0, attack: false, charge: false, jump: false,
            dodge: false, musou: false, pause: false, confirm: false, debug: false,
          }
          for (let i = 0; i < frames; i++) {
            const held = { moveX: input.moveX ?? 0, moveY: input.moveY ?? 0, camTurn: input.camTurn ?? 0, guard: input.guard ?? false }
            game.tick(1 / 60, i === 0 ? { ...idle, ...input } : { ...idle, ...held }, i === frames - 1)
          }
          return (window as unknown as { __game: { state: unknown } }).__game.state
        },
        /**
         * 效能量測：每幀都渲染並以 gl.finish() 等待 GPU 完成，回傳每幀耗時（毫秒）。
         * 期間每 8 幀普攻一次，讓火花、碎片與刀光保持活躍。
         */
        benchmark: (frames = 120) => {
          const gl = game.pipeline.renderer.getContext()
          const idle: InputFrame = {
            moveX: 0, moveY: 0, camTurn: 0, zoom: 0, attack: false, charge: false, jump: false,
            dodge: false, musou: false, pause: false, confirm: false, debug: false,
          }
          const times: number[] = []
          for (let i = 0; i < frames; i++) {
            const t0 = performance.now()
            game.tick(1 / 60, { ...idle, attack: i % 8 === 0 }, true)
            gl.finish()
            times.push(performance.now() - t0)
          }
          times.sort((a, b) => a - b)
          const pick = (q: number) => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * q))] * 10) / 10
          const size = game.pipeline.renderer.getDrawingBufferSize(new Vector2())
          return {
            avg: Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10,
            p50: pick(0.5),
            p95: pick(0.95),
            max: pick(1),
            drawCalls: game.pipeline.sceneDrawCalls,
            triangles: game.pipeline.sceneTriangles,
            buffer: [size.x, size.y],
            fragments: game.fragments.active,
          }
        },
        /** 對全場敵兵造成傷害（驗證勝利流程用）。 */
        damageAll: (damage: number) => battle.debug.damageAll(damage),
      },
    })
  }
}
