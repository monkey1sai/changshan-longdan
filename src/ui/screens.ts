import { subscribe, t } from './i18n.ts'
import type { DifficultyId } from '../core/difficulty.ts'

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
  private lastResult: ResultStats | null = null

  constructor() {
    subscribe(() => {
      if (this.lastResult !== null && !this.result.hidden) this.renderResult(this.lastResult)
    })
  }

  onStart(handler: () => void): void {
    must<HTMLButtonElement>('start').addEventListener('click', handler)
  }

  selectedDifficulty(): DifficultyId {
    const value = must<HTMLSelectElement>('difficulty-select').value
    return value === 'beginner' || value === 'hard' || value === 'chaos' ? value : 'normal'
  }

  onRetry(handler: () => void): void {
    must<HTMLButtonElement>('retry').addEventListener('click', handler)
  }

  onResume(handler: () => void): void {
    must<HTMLButtonElement>('resume').addEventListener('click', handler)
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
