import { afterEach, describe, expect, it, vi } from 'vitest'
import { Input } from '../src/core/input.ts'

function setup() {
  const target = new EventTarget()
  const surface = new EventTarget()
  const input = new Input(target as unknown as Window, surface as unknown as HTMLElement)
  const key = (code: string, type = 'keydown') => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, repeat: false }))
  return { input, target, surface, key }
}
afterEach(() => vi.unstubAllGlobals())

describe('Input', () => {
  it('操作語言選單時不攔截鍵盤或保留遊戲按鍵', () => {
    const { input, target, key } = setup()
    key('KeyW')
    Object.assign(target, { closest: () => target })
    target.dispatchEvent(new Event('focusin'))
    expect(key('ArrowDown')).toBe(true)
    expect(key('Enter')).toBe(true)
    key('KeyJ')
    expect(input.poll()).toMatchObject({ moveX: 0, moveY: 0, attack: false, confirm: false })
  })
  it('按住普攻連發，放開停止', () => {
    const { input, key } = setup()
    key('KeyJ')
    expect(input.poll().attack).toBe(true)
    expect(input.poll(0.1).attack).toBe(false)
    expect(input.poll(0.1).attack).toBe(true)
    key('KeyJ', 'keyup')
    expect(input.poll(1).attack).toBe(false)
  })
  it('蓄力壓過自動普攻，防禦期間不自動出招', () => {
    const { input, key } = setup()
    key('KeyJ')
    key('KeyK')
    expect(input.poll()).toMatchObject({ charge: true, attack: false })
    expect(input.poll(0.2).attack).toBe(false)
    key('KeyF')
    expect(input.poll(0.5)).toMatchObject({ guard: true, attack: false })
    key('KeyJ', 'keyup')
    key('KeyJ')
    expect(input.poll().attack).toBe(true)
  })
  it('失焦清除動作、移動、滑鼠與滾輪', () => {
    const { input, target, surface, key } = setup()
    key('KeyW'); key('KeyK'); key('KeyF')
    surface.dispatchEvent(Object.assign(new Event('mousedown'), { button: 0 }))
    surface.dispatchEvent(Object.assign(new Event('wheel'), { deltaY: 1 }))
    target.dispatchEvent(new Event('blur'))
    expect(input.poll()).toMatchObject({ moveY: 0, charge: false, attack: false, guard: false, zoom: 0 })
  })
  it('手把重新連線可再次產生動作邊緣，且支援防禦／回正', () => {
    let connected = true
    const pad = { connected: true, axes: [0, 0, 0], buttons: Array.from({ length: 12 }, (_, i) => ({ pressed: i === 3 || i === 4 || i === 11 })) }
    vi.stubGlobal('navigator', { getGamepads: () => connected ? [pad] : [] })
    const { input } = setup()
    expect(input.poll()).toMatchObject({ charge: true, guard: true, recenter: true })
    expect(input.poll().charge).toBe(false)
    connected = false; input.poll(); connected = true
    expect(input.poll().charge).toBe(true)
  })
})
