import { Kind, type EnemyStore } from '../entities/enemies.ts'
import { BARRACKS, INNER, KEEP, WALL_THICK } from '../world/layout.ts'
import type { MoveId } from '../combat/moves.ts'
import type { PlayerState } from '../entities/player.ts'
import { combatGuide } from './combat-guide.ts'
import { moveName, subscribe, t } from './i18n.ts'

export interface HudState {
  ko: number
  remain: number
  hp: number
  maxHp: number
  musou: number // 0..100
  musouReady: boolean
  combo: number
  comboTime: number
  moveId: MoveId | null
  playerState: PlayerState
  counterReady: number
}

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`找不到 #${id}`)
  return el as T
}

/** 戰鬥 HUD：擊破數、血條、無雙條、連擊數、小地圖、橫幅與無雙字幕。 */
export class Hud {
  private readonly root = must('hud')
  private readonly ko = must('ko')
  private readonly remain = must('remain')
  private readonly hpFill = must('hp-fill')
  private readonly musouFill = must('musou-fill')
  private readonly musouBar = must('musou-bar')
  private readonly combo = must('combo')
  private readonly comboCount = must('combo-count')
  private readonly banner = must('banner')
  private readonly cutin = must('cutin')
  private readonly moveName = must('move-name')
  private readonly moveHint = must('move-hint')
  private readonly movePanel = must('move-panel')
  private readonly chain = must('chain-steps').children
  private readonly comboLife = must('combo-life')
  private readonly battleProgress = must('battle-progress')
  private readonly musouPrompt = must('musou-prompt')
  private readonly officerHud = must('officer-hud')
  private readonly officerName = must('officer-name')
  private readonly officerHp = must('officer-hp')
  private readonly minimap: CanvasRenderingContext2D
  private readonly last = { ko: -1, remain: -1, hp: -1, musou: -1, ready: false, combo: -1 }
  private bannerTime = 0
  private cached: HudState | null = null
  private bannerProvider: (() => string) | null = null

  constructor() {
    const canvas = must<HTMLCanvasElement>('minimap')
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('無法建立小地圖')
    this.minimap = ctx
    subscribe(() => {
      Object.assign(this.last, { ko: -1, remain: -1, hp: -1, musou: -1, ready: false, combo: -1 })
      if (this.cached !== null) this.update(this.cached, 0)
      if (this.bannerTime > 0 && this.bannerProvider !== null) this.banner.textContent = this.bannerProvider()
    })
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible
  }

  update(s: HudState, dt: number): void {
    this.cached = s
    const l = this.last
    if (s.ko !== l.ko) {
      this.ko.textContent = String(s.ko)
      l.ko = s.ko
      this.battleProgress.style.width = `${100 * s.ko / Math.max(1, s.ko + s.remain)}%`
    }
    if (s.remain !== l.remain) {
      this.remain.textContent = String(s.remain)
      l.remain = s.remain
    }
    const hp = Math.round((s.hp / s.maxHp) * 1000) / 10
    if (hp !== l.hp) {
      this.hpFill.style.width = `${hp}%`
      this.hpFill.classList.toggle('low', hp < 30)
      l.hp = hp
    }
    const musou = Math.round(s.musou * 10) / 10
    if (musou !== l.musou) {
      this.musouFill.style.width = `${musou}%`
      l.musou = musou
    }
    if (s.musouReady !== l.ready) {
      this.musouBar.classList.toggle('ready', s.musouReady)
      this.musouPrompt.hidden = !s.musouReady
      l.ready = s.musouReady
    }
    if (s.combo !== l.combo) {
      this.combo.classList.toggle('visible', s.combo >= 2)
      if (s.combo > l.combo && s.combo >= 2) {
        this.comboCount.textContent = String(s.combo)
        this.combo.classList.remove('pop')
        void this.combo.offsetWidth // 重新觸發 CSS 動畫
        this.combo.classList.add('pop')
      }
      l.combo = s.combo
    }
    this.comboLife.style.transform = `scaleX(${s.comboTime})`
    const name = s.moveId === null ? (s.playerState === 'guard' ? t('hud.guard') : t('hud.style')) : moveName(s.moveId)
    const hint = combatGuide(s.playerState, s.moveId, s.counterReady)
    if (this.moveName.textContent !== name) this.moveName.textContent = name
    if (this.moveHint.textContent !== hint) this.moveHint.textContent = hint
    this.movePanel.classList.toggle('counter-ready', s.counterReady > 0)
    const normal = s.moveId?.startsWith('N') ? Number(s.moveId.slice(1)) : 0
    for (let i = 0; i < this.chain.length; i++) this.chain[i].classList.toggle('lit', i < normal)
    if (this.bannerTime > 0) {
      this.bannerTime -= dt
      if (this.bannerTime <= 0) this.banner.classList.remove('visible')
    }
  }

  showBanner(text: string | (() => string), seconds = 2.2, tone = ''): void {
    this.bannerProvider = typeof text === 'function' ? text : null
    this.banner.textContent = typeof text === 'function' ? text() : text
    this.banner.className = `banner visible ${tone}`
    this.bannerTime = seconds
  }

  updateOfficer(store: EnemyStore, px: number, pz: number): void {
    let best = -1
    let bestD = 18 * 18
    for (let i = 0; i < store.count; i++) {
      if (store.alive[i] === 0 || store.kind[i] !== Kind.Captain) continue
      const dx = store.x[i] - px
      const dz = store.z[i] - pz
      const d2 = dx * dx + dz * dz
      if (d2 < bestD) { best = i; bestD = d2 }
    }
    this.officerHud.hidden = best < 0
    if (best < 0) return
    this.officerName.textContent = t('hud.officer')
    this.officerHp.style.width = `${100 * store.hp[best] / Math.max(1, store.maxHp[best])}%`
  }

  playCutin(): void {
    this.cutin.classList.remove('play')
    void this.cutin.offsetWidth
    this.cutin.classList.add('play')
  }

  drawMinimap(store: EnemyStore, px: number, pz: number, facing: number, camYaw: number): void {
    const ctx = this.minimap
    const size = ctx.canvas.width
    const half = INNER + WALL_THICK
    const s = size / (half * 2)
    const X = (x: number) => (x + half) * s
    const Z = (z: number) => (z + half) * s
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(12, 10, 16, 0.72)'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(92, 78, 64, 0.55)'
    ctx.fillRect(X(-INNER), Z(-INNER), INNER * 2 * s, INNER * 2 * s)
    ctx.strokeStyle = 'rgba(210, 180, 120, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(X(-INNER), Z(-INNER), INNER * 2 * s, INNER * 2 * s)
    ctx.fillStyle = 'rgba(40, 32, 30, 0.9)'
    for (const r of [KEEP, ...BARRACKS]) ctx.fillRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * s, (r.maxZ - r.minZ) * s)

    for (let i = 0; i < store.count; i++) {
      if (store.alive[i] === 0) continue
      const captain = store.kind[i] === Kind.Captain
      ctx.fillStyle = captain ? '#ffcf5a' : store.engaged[i] === 1 ? '#ff5a4a' : '#c0392b'
      const r = captain ? 2.4 : 1.4
      ctx.fillRect(X(store.x[i]) - r, Z(store.z[i]) - r, r * 2, r * 2)
    }

    // 視野扇形與趙雲
    const cx = X(px)
    const cz = Z(pz)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.beginPath()
    ctx.moveTo(cx, cz)
    ctx.arc(cx, cz, 26, Math.PI / 2 - camYaw - 0.55, Math.PI / 2 - camYaw + 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.save()
    ctx.translate(cx, cz)
    ctx.rotate(-facing)
    ctx.fillStyle = '#7dffb0'
    ctx.beginPath()
    ctx.moveTo(0, 6)
    ctx.lineTo(4, -4)
    ctx.lineTo(-4, -4)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}
