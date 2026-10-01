import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLocale, moveName, setLocale, subscribe, t, translations } from '../src/ui/i18n.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  setLocale('zh-Hant')
})

describe('i18n', () => {
  it('戰場階段有中英訊息，切換語系後可重新取得', () => {
    for (const phase of ['opening', 'pressure', 'surge', 'finale'] as const) {
      setLocale('zh-Hant')
      const chinese = t(`battle.${phase}`)
      expect(chinese).toMatch(/[\u4e00-\u9fff]/)
      setLocale('en')
      expect(t(`battle.${phase}`)).not.toMatch(/[\u4e00-\u9fff]/)
      expect(t(`battle.${phase}`)).not.toBe(chinese)
    }
  })

  it('繁中與英文的動態翻譯鍵完全一致', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations['zh-Hant']).sort())
  })

  it('切換語系會翻譯參數與招式名，並通知訂閱者', () => {
    const observed: string[] = []
    const unsubscribe = subscribe((locale) => observed.push(locale))
    setLocale('en')
    expect(getLocale()).toBe('en')
    expect(t('guide.normalCharge', { move: moveName('C2'), purpose: 'Rising pursuit' })).toContain('Rising Dragon')
    unsubscribe()
    setLocale('zh-Hant')
    expect(observed).toEqual(['en'])
    expect(moveName('COUNTER')).toBe('龍膽返')
  })

  it('儲存空間寫入被封鎖時仍可切換目前工作階段語系', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('blocked') } })
    setLocale('en')
    expect(getLocale()).toBe('en')
  })

  it('不支援的已儲存語系會安全回退為繁中', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => 'fr' })
    const isolated = await import('../src/ui/i18n.ts')
    expect(isolated.getLocale()).toBe('zh-Hant')
  })
})
