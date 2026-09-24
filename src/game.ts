import { Color, FogExp2, PMREMGenerator, Scene, Vector2, Vector3 } from 'three'
import { AudioEngine } from './audio/audio-engine.ts'
import { Music } from './audio/music.ts'
import type { HitFx, HitWindow } from './combat/moves.ts'
import { nextStamp } from './combat/stamp.ts'
import { Input, type InputFrame } from './core/input.ts'
import { clamp, createRng, damp } from './core/math.ts'
import { Arena } from './entities/arena.ts'
import { EnemyStore, squadSpawns, type HitInfo } from './entities/enemies.ts'
import { MUSOU_MAX, Player, type AimFn, type PlayerControls } from './entities/player.ts'
import { Dragon } from './fx/dragon.ts'
import { Dust } from './fx/dust.ts'
import { Fragments } from './fx/fragments.ts'
import { Shockwaves } from './fx/shockwave.ts'
import { Sparks } from './fx/sparks.ts'
import { Trail } from './fx/trail.ts'
import { Pipeline, type PostSettings } from './render/pipeline.ts'
import { Hud } from './ui/hud.ts'
import { Screens } from './ui/screens.ts'
import { CameraRig } from './view/camera-rig.ts'
import { PlayerModel } from './view/player-model.ts'
import { SoldierView } from './view/soldier-view.ts'
import { buildCastle } from './world/castle.ts'
import { FireField, type FireSource } from './world/fire.ts'
import { Flags } from './world/flags.ts'
import { BIG_FIRES, BRAZIERS, obstacles, PLAY_LIMIT, PLAYER_START, SQUADS } from './world/layout.ts'
import { Lighting } from './world/lights.ts'
import { Sky } from './world/sky.ts'
import { createFlagTexture, createGroundTexture } from './world/textures.ts'

type Mode = 'title' | 'playing' | 'paused' | 'victory' | 'defeat'

const CAPACITY = 320
const MUSIC_LEVEL = 0.42
const SHOCK = new Color(3.2, 2.2, 1.2)
const GOLD = new Color(5, 3.4, 1.1)
const WHITE = new Color(6, 6, 5)

/** 龍頭撞擊：盤旋中每 0.12 秒一次，把附近敵兵撞上天。 */
const DRAGON_HIT: HitWindow = {
  t0: 0, t1: 0, shape: { kind: 'circle', range: 2.8 }, damage: 16, reaction: 'launch',
  push: 7, lift: 7, hitstop: 0, shake: 0.05, radial: true, yMin: -8, yMax: 2, sfx: 'light',
}

/** 遊戲主體：擁有場景、所有系統與主迴圈。 */
export class Game {
  private readonly pipeline: Pipeline
  private readonly scene = new Scene()
  private readonly rig: CameraRig
  private readonly input: Input
  private readonly arena = new Arena(PLAY_LIMIT, obstacles())
  private readonly player = new Player()
  private readonly enemies = new EnemyStore(CAPACITY)
  private readonly model = new PlayerModel()
  private readonly soldiers = new SoldierView(CAPACITY)
  private readonly fragments = new Fragments()
  private readonly sparks = new Sparks()
  private readonly dust = new Dust()
  private readonly trail = new Trail()
  private readonly waves = new Shockwaves()
  private readonly dragon = new Dragon()
  private readonly sky = new Sky()
  private readonly flags: Flags
  private readonly fire: FireField
  private readonly lighting: Lighting
  private readonly hud = new Hud()
  private readonly screens = new Screens()
  private readonly rng = createRng(99)
  private readonly post: PostSettings = { focus: 9, musou: 0, flash: 0, aberration: 0, radial: 0, danger: 0, bars: 0, exposure: 1 }
  private readonly hits: HitInfo[] = []
  private readonly tmp = new Vector3()
  private readonly controls: PlayerControls = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false }
  private readonly aim: AimFn = (x, z, maxDist) => {
    const i = this.enemies.nearest(x, z, maxDist)
    return i < 0 ? null : { x: this.enemies.x[i], z: this.enemies.z[i] }
  }
  private audio: AudioEngine | null = null
  private music: Music | null = null
  private mode: Mode = 'title'
  private last = 0
  private clock = 0 // 真實時間
  private simClock = 0 // 遊戲時間（命中停頓時暫停）
  private battleTime = 0
  private hitstop = 0
  private slowmo = 0
  private debugTimeScale = 1
  private combo = 0
  private comboTimer = 0
  private maxCombo = 0
  private ko = 0
  private damageTaken = 0
  private endTimer = 0
  private resultShown = false
  private dragonStamp = 0
  private dragonHitTimer = 0
  private roarsPlayed = 0
  private wasMusou = false
  private musouWasReady = false
  private frameAvg = 1 / 60
  private qualityTimer = 0
  private minimapTick = 0
  private readonly perf = document.getElementById('perf')

  constructor(canvas: HTMLCanvasElement) {
    this.pipeline = new Pipeline(canvas)
    this.rig = new CameraRig(window.innerWidth / window.innerHeight)
    this.input = new Input(window, canvas)

    const castle = buildCastle(createGroundTexture())
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
      this.waves.group,
      this.dragon.group,
    )

    window.addEventListener('resize', () => this.resize())
    this.resize()
    // 瀏覽器規定音訊必須在使用者互動後才能播放
    const unlock = () => this.ensureAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    this.screens.onStart(() => this.startBattle())
    this.screens.onRetry(() => this.startBattle())
    this.screens.onResume(() => this.setPaused(false))

    this.resetBattle()
    this.rig.snap(this.player.pos, PLAYER_START.facing)
    if (import.meta.env.DEV) this.exposeDebug()
  }

  start(): void {
    requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame)
    const realDt = this.last === 0 ? 1 / 60 : Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.tick(realDt, this.input.poll(), true)
  }

  private tick(realDt: number, input: InputFrame, render: boolean): void {
    this.clock += realDt
    this.handleModeInput(input)
    const simDt = this.mode === 'playing' || this.mode === 'victory' || this.mode === 'defeat' ? this.simulate(realDt, input) : 0
    this.simClock += simDt
    this.updateVisuals(realDt, simDt, input)
    if (render) this.pipeline.render(this.scene, this.rig.camera, this.post, this.clock)
    this.trackPerformance(realDt)
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
    this.ensureAudio()
    this.resetBattle()
    this.mode = 'playing'
    this.screens.showTitle(false)
    this.screens.showPause(false)
    this.screens.hideResult()
    this.hud.setVisible(true)
    this.rig.yaw = PLAYER_START.facing
    this.music?.setMode('battle')
    this.audio?.setMusicLevel(MUSIC_LEVEL)
    this.audio?.uiConfirm()
    this.hud.showBanner('出陣！', 2)
  }

  private resetBattle(): void {
    this.player.reset(PLAYER_START.x, PLAYER_START.z, PLAYER_START.facing)
    this.enemies.reset(squadSpawns(SQUADS, createRng(7)))
    this.soldiers.applyColors(this.enemies, createRng(8))
    this.fragments.clear()
    this.sparks.clear()
    this.dust.clear()
    this.trail.clear()
    this.waves.clear()
    this.dragon.stop()
    this.model.resetCape()
    this.combo = 0
    this.comboTimer = 0
    this.maxCombo = 0
    this.ko = 0
    this.damageTaken = 0
    this.battleTime = 0
    this.hitstop = 0
    this.slowmo = 0
    this.endTimer = 0
    this.resultShown = false
    this.wasMusou = false
    this.musouWasReady = false
    Object.assign(this.post, { musou: 0, flash: 0, aberration: 0, radial: 0, danger: 0, bars: 0 })
  }

  private setPaused(paused: boolean): void {
    if (paused && this.mode !== 'playing') return
    if (!paused && this.mode !== 'paused') return
    this.mode = paused ? 'paused' : 'playing'
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
      case 'victory':
      case 'defeat':
        if (this.resultShown && input.confirm) this.startBattle()
        break
    }
  }

  /** 推進一幀遊戲邏輯，回傳實際推進的遊戲時間（命中停頓時為 0）。 */
  private simulate(realDt: number, input: InputFrame): number {
    const c = this.controls
    const f = this.rig.forward
    const r = this.rig.right
    const active = this.mode === 'playing'
    let mx = active ? f.x * input.moveY + r.x * input.moveX : 0
    let mz = active ? f.z * input.moveY + r.z * input.moveX : 0
    const len = Math.hypot(mx, mz)
    if (len > 1) {
      mx /= len
      mz /= len
    }
    c.moveX = mx
    c.moveZ = mz
    c.attack = active && input.attack
    c.charge = active && input.charge
    c.jump = active && input.jump
    c.dodge = active && input.dodge
    c.musou = active && input.musou

    if (this.hitstop > 0) {
      this.hitstop -= realDt
      this.player.queue(c)
      return 0
    }
    if (this.slowmo > 0) this.slowmo -= realDt
    const dt = realDt * (this.slowmo > 0 ? 0.3 : 1) * this.debugTimeScale
    if (active) this.battleTime += dt

    this.player.update(dt, c, this.aim, this.arena)
    this.enemies.update(dt, this.player.pos.x, this.player.pos.y, this.player.pos.z, this.arena)
    this.handlePlayerEvents()
    this.resolvePlayerHits()
    this.updateDragon(dt)
    this.resolveKills()
    this.resolveStrikes()
    this.comboTimer -= dt
    if (this.comboTimer <= 0) this.combo = 0
    this.checkEnd(realDt)
    return dt
  }

  private handlePlayerEvents(): void {
    const p = this.player.pos
    for (const e of this.player.events) {
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
    const fxX = x + Math.sin(this.player.facing) * 6
    const fxZ = z + Math.cos(this.player.facing) * 6
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

  private resolvePlayerHits(): void {
    for (const h of this.player.activeHits) {
      this.hits.length = 0
      this.enemies.applyHit(h.stamp, h.window, h.x, h.y, h.z, h.facing, this.hits)
      if (this.hits.length > 0) this.onHits(h.window, this.hits)
    }
  }

  private onHits(win: HitWindow, hits: HitInfo[]): void {
    const heavy = win.sfx === 'heavy'
    this.hitstop = Math.max(this.hitstop, win.hitstop)
    this.rig.addTrauma(win.shake * (hits.length > 3 ? 1.15 : 1))
    if (heavy) {
      this.rig.kick(0.5)
      this.post.aberration = Math.max(this.post.aberration, 0.8)
    }
    this.addCombo(hits.length)
    this.player.gainMusou(Math.min(9, hits.length * 1.4))
    for (const h of hits) this.sparks.burst(h.x, h.y + 1.1, h.z, h.dirX, h.dirZ, heavy ? 12 : 7, heavy, this.rng)
    this.audio?.hit(win.sfx, hits.length, this.pan(hits[0].x, hits[0].z))
  }

  private addCombo(n: number): void {
    this.combo += n
    this.comboTimer = 2.4
    this.maxCombo = Math.max(this.maxCombo, this.combo)
  }

  private beginMusou(): void {
    this.dragon.start(this.player.pos, this.player.facing)
    this.roarsPlayed = 0
    this.dragonHitTimer = 0
    this.hud.playCutin()
    this.audio?.musouStart()
    this.audio?.setMusicLevel(0.14, 0.2)
    this.rig.addTrauma(0.35)
    this.post.radial = 1
  }

  private updateDragon(dt: number): void {
    if (!this.dragon.active) return
    this.dragon.update(dt, this.player.pos, this.player.facing)
    const t = this.dragon.elapsed
    if ((this.roarsPlayed === 0 && t > 0.35) || (this.roarsPlayed === 1 && t > 2.75)) {
      this.audio?.dragonRoar()
      this.roarsPlayed++
    }
    if (this.dragon.striking) {
      this.dragonHitTimer -= dt
      if (this.dragonHitTimer <= 0) {
        this.dragonHitTimer = 0.12
        this.dragonStamp = nextStamp()
      }
      const head = this.dragon.headPos
      this.hits.length = 0
      this.enemies.applyHit(this.dragonStamp, DRAGON_HIT, head.x, head.y, head.z, 0, this.hits)
      if (this.hits.length > 0) {
        this.addCombo(this.hits.length)
        for (const h of this.hits) this.sparks.burst(h.x, h.y + 1.1, h.z, h.dirX, h.dirZ, 6, false, this.rng)
        this.audio?.hit('light', this.hits.length, this.pan(head.x, head.z))
      }
    }
    for (let i = 0; i < 5; i++) {
      this.dragon.randomPoint(this.rng, this.tmp)
      this.sparks.glitter(this.tmp.x, this.tmp.y, this.tmp.z, 4.5, 3.2, 1, this.rng)
    }
  }

  private resolveKills(): void {
    const kills = this.enemies.kills
    if (kills.length === 0) return
    const before = this.ko
    for (const k of kills) {
      this.fragments.spawnSoldier(k, this.rng)
      this.dust.puff(k.x, 0, k.z, 3, 2.5, this.rng)
    }
    this.ko += kills.length
    this.audio?.shatter(kills.length, this.pan(kills[0].x, kills[0].z))
    kills.length = 0
    if (Math.floor(before / 100) < Math.floor(this.ko / 100) && this.enemies.aliveCount > 0) {
      this.hud.showBanner(`${Math.floor(this.ko / 100) * 100} 人斬！`, 2, 'gold')
      this.audio?.milestone()
    } else if (before < 150 && this.ko >= 150 && this.enemies.aliveCount > 0) {
      this.hud.showBanner('魏軍 半數潰滅', 2)
    }
  }

  private resolveStrikes(): void {
    const p = this.player.pos
    for (const s of this.enemies.strikes) {
      this.audio?.enemySwing(this.pan(s.x, s.z))
      if (!this.player.takeHit(s.damage, s.heavy, s.x, s.z)) continue
      this.damageTaken += s.damage
      this.combo = 0
      this.comboTimer = 0
      this.audio?.playerHurt(s.heavy)
      this.rig.addTrauma(s.heavy ? 0.45 : 0.25)
      const dx = p.x - s.x
      const dz = p.z - s.z
      const d = Math.hypot(dx, dz) || 1
      this.sparks.burst(p.x, p.y + 1.2, p.z, dx / d, dz / d, 6, s.heavy, this.rng)
    }
  }

  private checkEnd(realDt: number): void {
    if (this.mode === 'playing') {
      if (this.enemies.aliveCount === 0) {
        this.mode = 'victory'
        this.slowmo = 1.6
        this.endTimer = 2.4
        this.hud.showBanner('完全勝利', 3, 'gold')
        this.audio?.victory()
        this.audio?.setMusicLevel(0.2)
      } else if (this.player.state === 'dead') {
        this.mode = 'defeat'
        this.slowmo = 1.2
        this.endTimer = 2.4
        this.hud.showBanner('趙雲 敗走…', 3)
        this.audio?.defeat()
        this.audio?.setMusicLevel(0.12)
      }
      return
    }
    this.endTimer -= realDt
    if (this.endTimer <= 0 && !this.resultShown) {
      this.resultShown = true
      this.screens.showResult({
        win: this.mode === 'victory',
        ko: this.ko,
        maxCombo: this.maxCombo,
        seconds: this.battleTime,
        damage: this.damageTaken,
      })
    }
  }

  private updateVisuals(realDt: number, simDt: number, input: InputFrame): void {
    const musou = this.player.state === 'musou'
    if (this.wasMusou && !musou && this.mode === 'playing') this.audio?.setMusicLevel(MUSIC_LEVEL, 1)
    this.wasMusou = musou

    this.rig.update(realDt, this.player.pos, this.mode === 'playing' ? input.camTurn : 0, input.zoom, musou, this.mode === 'title', this.clock)
    const p = this.post
    p.musou = damp(p.musou, musou ? 1 : 0, musou ? 12 : 4, realDt)
    p.bars = damp(p.bars, musou ? 1 : 0, 8, realDt)
    p.flash = damp(p.flash, 0, 9, realDt)
    p.aberration = damp(p.aberration, 0, 7, realDt)
    p.radial = damp(p.radial, 0, 5, realDt)
    const hpRatio = this.player.hp / this.player.maxHp
    const danger = this.mode === 'playing' && hpRatio < 0.3 ? (0.55 + 0.45 * Math.sin(this.clock * 5)) * (1 - hpRatio / 0.3 + 0.3) : 0
    p.danger = damp(p.danger, clamp(danger, 0, 1), 6, realDt)
    p.focus = this.rig.focusDistance

    const camera = this.rig.camera
    const sizeScale = this.pipeline.renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360))
    this.sky.update(camera, this.clock)
    this.flags.update(this.clock)
    this.fire.update(this.clock, this.rig.focus, sizeScale)
    this.lighting.update(this.rig.focus, this.clock)

    this.model.update(this.player, simDt, this.clock)
    this.soldiers.update(this.enemies, this.clock)
    this.fragments.update(simDt)
    this.sparks.update(simDt)
    this.dust.update(simDt, sizeScale)
    this.waves.update(simDt)
    this.updateTrail()

    if (this.mode !== 'title') {
      this.hud.update(
        {
          ko: this.ko,
          remain: this.enemies.aliveCount,
          hp: this.player.hp,
          maxHp: this.player.maxHp,
          musou: this.player.musou,
          musouReady: this.player.musouReady,
          combo: this.combo,
        },
        realDt,
      )
      if (++this.minimapTick % 3 === 0) {
        this.hud.drawMinimap(this.enemies, this.player.pos.x, this.player.pos.z, this.player.facing, this.rig.yaw)
      }
    }
    const ready = this.player.musouReady
    if (ready && !this.musouWasReady && this.mode === 'playing') {
      this.audio?.musouReady()
      this.hud.showBanner('無雙 就緒', 1.4, 'gold')
    }
    this.musouWasReady = ready
  }

  private updateTrail(): void {
    const p = this.player
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
        `tris ${Math.round(this.pipeline.sceneTriangles / 1000)}k · 存活 ${this.enemies.aliveCount} · ` +
        `碎片 ${this.fragments.active} · 解析度 ${this.pipeline.qualityScale.toFixed(2)}`
    }
  }

  /** 開發模式下提供給自動化驗證使用的除錯介面。 */
  private exposeDebug(): void {
    const game = this
    Object.assign(window, {
      __game: {
        get state() {
          return {
            mode: game.mode,
            ko: game.ko,
            alive: game.enemies.aliveCount,
            hp: game.player.hp,
            musou: game.player.musou,
            playerState: game.player.state,
            move: game.player.move?.id ?? null,
            combo: game.combo,
            maxCombo: game.maxCombo,
            fps: Math.round(1 / game.frameAvg),
            quality: game.pipeline.qualityScale,
            drawCalls: game.pipeline.sceneDrawCalls,
            triangles: game.pipeline.sceneTriangles,
            fragments: game.fragments.active,
            dragon: game.dragon.active,
            position: [game.player.pos.x, game.player.pos.y, game.player.pos.z],
            audio: game.audio?.ctx.state ?? 'none',
          }
        },
        start: () => game.startBattle(),
        fillMusou: () => {
          game.player.musou = MUSOU_MAX
        },
        heal: () => {
          game.player.hp = game.player.maxHp
        },
        setHp: (hp: number) => {
          game.player.hp = hp
        },
        setTimeScale: (scale: number) => {
          game.debugTimeScale = scale
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
            const held = { moveX: input.moveX ?? 0, moveY: input.moveY ?? 0, camTurn: input.camTurn ?? 0 }
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
        damageAll: (damage: number) => {
          const win: HitWindow = { ...DRAGON_HIT, shape: { kind: 'circle', range: 400 }, damage, yMin: -50, yMax: 50 }
          game.hits.length = 0
          game.enemies.applyHit(nextStamp(), win, game.player.pos.x, 0, game.player.pos.z, 0, game.hits)
          return game.hits.length
        },
      },
    })
  }
}
