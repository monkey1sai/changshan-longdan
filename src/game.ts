import { Color, FogExp2, PMREMGenerator, Scene, Vector2, type Mesh } from 'three'
import { AudioEngine } from './audio/audio-engine.ts'
import { Music } from './audio/music.ts'
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
import { MUSIC_LEVEL, Presentation } from './presentation.ts'
import { Pipeline, type PostSettings } from './render/pipeline.ts'
import { Hud } from './ui/hud.ts'
import { translate } from './ui/i18n.ts'
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

/** 遊戲主體：擁有場景、所有系統與主迴圈。 */
export class Game {
  private readonly pipeline: Pipeline
  private readonly scene = new Scene()
  private readonly rig: CameraRig
  private readonly barracksRoofs: Mesh[]
  private readonly input: Input
  private readonly battle = new Battle(castleSetup())
  private readonly presentation: Presentation
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
  private readonly controls: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }
  private audio: AudioEngine | null = null
  private music: Music | null = null
  private mode: Mode = 'title'
  private last = 0
  private clock = 0 // 真實時間
  private simClock = 0 // 遊戲時間（命中停頓時暫停）
  private endTimer = 0
  private resultShown = false
  private frameAvg = 1 / 60
  private qualityTimer = 0
  private minimapTick = 0
  private readonly perf = document.getElementById('perf')

  constructor(canvas: HTMLCanvasElement) {
    this.pipeline = new Pipeline(canvas)
    this.rig = new CameraRig(window.innerWidth / window.innerHeight)
    this.input = new Input(window, canvas, () => this.mode === 'title')
    this.presentation = new Presentation({
      audio: () => this.audio, sparks: this.sparks, dust: this.dust, waves: this.waves, fragments: this.fragments,
      camera: this.rig, post: this.post, hud: this.hud, dragon: this.dragon, rng: this.rng,
    })

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
    this.presentation.reset()
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
    this.presentation.play(this.battle.events, this.battle)
    this.applyOutcome(this.battle.events)
    if (dt > 0) this.updateDragon()
    return dt
  }

  /** 勝負分出：轉入結束畫面流程，稍後顯示戰果。 */
  private applyOutcome(events: readonly BattleEvent[]): void {
    for (const e of events) {
      if (e.type !== 'victory' && e.type !== 'defeat') continue
      this.mode = 'ended'
      this.endTimer = 2.4
    }
  }

  /** 遊戲時間前進時更新蒼龍畫面，再播放龍吼與龍身光點。 */
  private updateDragon(): void {
    const strike = this.battle.dragon
    if (!strike.active && !this.dragon.active) return
    this.dragon.update(strike)
    this.presentation.dragonFrame(strike)
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
    this.presentation.musouState(musou, this.mode === 'playing')

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
          game.presentation.play(battle.events, battle)
          game.applyOutcome(battle.events)
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
