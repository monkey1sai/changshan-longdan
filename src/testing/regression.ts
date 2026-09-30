import type { InputFrame } from '../core/input.ts'

/** Dev-only consumer; not imported by the game entry point. */
export interface ProbeState {
  mode: string
  hp: number
  musou: number
  playerState: string
  move: string | null
  alive: number
  ko: number
  counterReady: number
  facing: number
  position: number[]
}
export interface GameProbe {
  readonly state: ProbeState
  start(): void
  advance(frames: number, input?: Partial<InputFrame>): ProbeState
  strike(damage: number, heavy?: boolean, fromX?: number, fromZ?: number): void
  fillMusou(): void
  setHp(hp: number): void
  setTimeScale(scale: number): void
}
export const CASES = {
  start: '標題確認開始戰鬥，顯示 HUD 並重設血量與敵兵',
  pause: '暫停凍結玩家位置與血量，恢復後可移動',
  attack: '普攻進入 N1，結束後離開攻擊狀態',
  guard: '正面完美格擋、一般格擋 chip 傷害與背面受傷',
  musou: '未充滿不能發動；充滿後消耗氣、無敵並正常結束',
  defeat: '致死傷害進入敗北，延遲顯示結果並可重新開始',
} as const
export type CaseId = keyof typeof CASES
export const CASE_IDS = Object.keys(CASES) as CaseId[]

export function compactState(s: ProbeState) {
  return {
    mode: s.mode, hp: s.hp, musou: s.musou, playerState: s.playerState,
    move: s.move, alive: s.alive, ko: s.ko, counterReady: s.counterReady,
    facing: s.facing, position: [...s.position],
  }
}
export interface Check { name: string; pass: boolean; actual: unknown; expected: unknown }
export interface CaseResult {
  id: CaseId
  status: 'PASS' | 'FAIL' | 'ERROR'
  elapsedMs: number
  checks: Check[]
  before: ReturnType<typeof compactState>
  after: ReturnType<typeof compactState>
  error: string | null
}

/** One synchronous browser task prevents rAF from racing the fixed steps. */
export function runCase(id: CaseId, game: GameProbe, hidden: (id: string) => boolean): CaseResult {
  if (!CASE_IDS.includes(id)) throw new Error('Unknown regression case')
  const checks: Check[] = []
  const started = performance.now()
  const before = compactState(game.state)
  const eq = (name: string, actual: unknown, expected: unknown) => {
    checks.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected })
  }
  const reset = () => { game.start(); game.setTimeScale(1) }
  const strikeFacing = (damage: number, rear = false) => {
    const s = game.state
    const distance = rear ? -2 : 2
    game.strike(damage, false, s.position[0]! + Math.sin(s.facing) * distance,
      s.position[2]! + Math.cos(s.facing) * distance)
  }
  let error: string | null = null
  try {
    game.setTimeScale(1)
    if (id !== 'start') reset()
    switch (id) {
      case 'start':
        eq('initial title mode', game.state.mode, 'title')
        eq('title visible', hidden('title'), false)
        game.advance(1, { confirm: true })
        eq('playing', game.state.mode, 'playing')
        eq('title hidden', hidden('title'), true)
        eq('HUD visible', hidden('hud'), false)
        eq('full initial hp', game.state.hp, 1000)
        eq('300 soldiers', game.state.alive, 300)
        eq('zero kills', game.state.ko, 0)
        break
      case 'pause': {
        game.advance(1, { pause: true })
        eq('paused', game.state.mode, 'paused')
        eq('pause visible', hidden('pause'), false)
        const paused = compactState(game.state)
        game.advance(120, { moveX: 1, attack: true })
        eq('position frozen', game.state.position, paused.position)
        eq('hp frozen', game.state.hp, paused.hp)
        eq('attack ignored', game.state.move, paused.move)
        game.advance(1, { pause: true })
        eq('resumed', game.state.mode, 'playing')
        eq('pause hidden', hidden('pause'), true)
        game.advance(10, { moveX: 1 })
        eq('movement resumes', JSON.stringify(game.state.position) !== JSON.stringify(paused.position), true)
        break
      }
      case 'attack':
        game.advance(1, { attack: true })
        eq('attack state', game.state.playerState, 'attack')
        eq('first normal move', game.state.move, 'N1')
        game.advance(60)
        eq('attack completed', game.state.move, null)
        eq('free state', game.state.playerState, 'move')
        break
      case 'guard': {
        game.advance(1, { guard: true })
        eq('guard entered', game.state.playerState, 'guard')
        const hp = game.state.hp
        strikeFacing(80)
        eq('parry prevents damage', game.state.hp, hp)
        eq('counter available', game.state.counterReady > 0, true)
        reset()
        game.advance(12, { guard: true })
        strikeFacing(80)
        eq('normal block chip is 20', game.state.hp, 980)
        eq('guard maintained', game.state.playerState, 'guard')
        reset()
        game.advance(1, { guard: true })
        strikeFacing(80, true)
        eq('rear hit deals full damage', game.state.hp, 920)
        eq('rear hit interrupts guard', game.state.playerState, 'hurt')
        break
      }
      case 'musou': {
        game.advance(1, { musou: true })
        eq('empty meter cannot activate', game.state.playerState, 'move')
        reset()
        game.fillMusou()
        eq('meter filled for setup', game.state.musou, 100)
        game.advance(1, { musou: true })
        eq('musou active', game.state.playerState, 'musou')
        eq('meter consumed', game.state.musou, 0)
        const hp = game.state.hp
        strikeFacing(80)
        eq('invulnerable during musou', game.state.hp, hp)
        game.advance(300)
        eq('musou completes', game.state.playerState, 'move')
        break
      }
      case 'defeat':
        game.setHp(1)
        strikeFacing(80)
        eq('hp reaches zero', game.state.hp, 0)
        eq('player dead', game.state.playerState, 'dead')
        eq('defeat mode', game.state.mode, 'defeat')
        eq('result initially hidden', hidden('result'), true)
        game.advance(180)
        eq('result shown', hidden('result'), false)
        game.advance(1, { confirm: true })
        eq('retry playing', game.state.mode, 'playing')
        eq('retry full hp', game.state.hp, 1000)
        eq('retry result hidden', hidden('result'), true)
        break
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  return {
    id, status: error !== null ? 'ERROR' : checks.length > 0 && checks.every(c => c.pass) ? 'PASS' : 'FAIL',
    elapsedMs: performance.now() - started, checks, before, after: compactState(game.state), error,
  }
}
