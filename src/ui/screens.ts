import { subscribe, t, translate } from './i18n.ts'
import { isLevelId, type LevelId } from '../world/levels.ts'

export interface ResultStats {
  win: boolean
  ko: number
  maxCombo: number
  seconds: number
  damage: number
}

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`找不到 #${id}`)
  return el as T
}

function rank(s: ResultStats): string {
  if (!s.win) return s.ko >= 200 ? 'B' : s.ko >= 100 ? 'C' : 'D'
  if (s.seconds < 300 && s.damage < 400) return 'S'
  if (s.seconds < 480) return 'A'
  return 'B'
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 標題、暫停與戰果畫面。 */
export class Screens {
  private readonly title = must('title')
  private readonly pause = must('pause')
  private readonly result = must('result')
  private readonly resultTitle = must('result-title')
  private readonly resultStats = must('result-stats')
  private readonly missionSubtitle = must('mission-subtitle')
  private readonly stageStory = must('stage-story')
  private lastResult: ResultStats | null = null

  constructor() {
    subscribe(() => {
      this.renderLevelCopy()
      if (this.lastResult !== null && !this.result.hidden) this.renderResult(this.lastResult)
    })
    this.renderLevelCopy()
  }

  onStart(handler: () => void): void {
    must<HTMLButtonElement>('start').addEventListener('click', handler)
  }

  onRetry(handler: () => void): void {
    must<HTMLButtonElement>('retry').addEventListener('click', handler)
  }

  onResume(handler: () => void): void {
    must<HTMLButtonElement>('resume').addEventListener('click', handler)
  }

  onReturnToTitle(handler: () => void): void {
    must<HTMLButtonElement>('change-level').addEventListener('click', handler)
    must<HTMLButtonElement>('result-level').addEventListener('click', handler)
  }

  onLevelSelect(handler: (level: LevelId) => void): void {
    document.querySelectorAll<HTMLInputElement>('input[name="level"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked && isLevelId(radio.value)) {
          this.renderLevelCopy()
          handler(radio.value)
        }
      })
    })
  }

  selectedLevel(): LevelId {
    const selected = document.querySelector<HTMLInputElement>('input[name="level"]:checked')?.value ?? ''
    return isLevelId(selected) ? selected : 'fortress'
  }

  private renderLevelCopy(): void {
    if (this.selectedLevel() === 'moonlit-manor') {
      this.missionSubtitle.textContent = translate('月影邊境 守護村落三百影', 'Moonlit Frontier · 300 Shadows to Defeat')
      this.stageStory.textContent = translate(
        '星燈使迦蘭與巡林者燐歌在宅邸前求援；擊退夜林影兵，守住村落。',
        'Lantern mage Kalan and forest scout Rinka call for aid at the manor. Defeat the night-forest shadows and defend the village.',
      )
      return
    }
    this.missionSubtitle.textContent = translate('趙子龍 單騎破魏三百', 'One warrior. Three hundred foes.')
    this.stageStory.textContent = translate(
      '黃昏城池，魏兵列陣；以龍膽槍法突破三百人的包圍。',
      'At dusk, Wei soldiers form ranks around the fortress. Break through all three hundred with the Dragon Spear.',
    )
  }

  showTitle(visible: boolean): void {
    this.title.hidden = !visible
  }

  showPause(visible: boolean): void {
    this.pause.hidden = !visible
  }

  showResult(s: ResultStats): void {
    this.lastResult = { ...s }
    this.renderResult(this.lastResult)
    this.result.hidden = false
  }

  private renderResult(s: ResultStats): void {
    this.resultTitle.textContent = s.win ? t('result.victory') : t('result.defeat')
    this.resultTitle.className = s.win ? 'win' : 'lose'
    const rows: [string, string][] = [
      [t('result.ko'), String(s.ko)],
      [t('result.maxCombo'), String(s.maxCombo)],
      [t('result.time'), clock(s.seconds)],
      [t('result.damage'), String(Math.round(s.damage))],
      [t('result.rank'), rank(s)],
    ]
    this.resultStats.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = document.createElement('div')
        const dt = document.createElement('span')
        const dd = document.createElement('b')
        dt.textContent = label
        dd.textContent = value
        row.append(dt, dd)
        return row
      }),
    )
  }

  hideResult(): void {
    this.result.hidden = true
  }
}
