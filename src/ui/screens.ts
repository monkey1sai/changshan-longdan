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

  onStart(handler: () => void): void {
    must<HTMLButtonElement>('start').addEventListener('click', handler)
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
    this.resultTitle.textContent = s.win ? '完全勝利' : '趙雲 敗走'
    this.resultTitle.className = s.win ? 'win' : 'lose'
    const rows: [string, string][] = [
      ['擊破數', String(s.ko)],
      ['最大連擊', String(s.maxCombo)],
      ['戰鬥時間', clock(s.seconds)],
      ['受到傷害', String(Math.round(s.damage))],
      ['評價', rank(s)],
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
    this.result.hidden = false
  }

  hideResult(): void {
    this.result.hidden = true
  }
}
