import { getLocale, setLocale, subscribe } from './i18n.ts'

/** 靜態文案保留在 HTML；初始化時快取原文，切換不重建控制項或戰局。 */
export function initInterface(): void {
  const copy = Array.from(document.querySelectorAll<HTMLElement>('[data-en]'), (element) => ({
    element,
    zh: element.textContent ?? '',
    en: element.dataset.en ?? '',
  }))
  const selector = document.querySelector<HTMLSelectElement>('#language-select')!
  const render = () => {
    const locale = getLocale()
    document.documentElement.lang = locale
    document.title = locale === 'en' ? 'Changshan Longdan' : '常山龍膽'
    for (const item of copy) item.element.textContent = locale === 'en' ? item.en : item.zh
    selector.value = locale
    document.querySelector('#chain-steps')?.setAttribute('aria-label', locale === 'en' ? 'Normal combo progress' : '普攻連段進度')
    document.querySelectorAll('#chain-steps i').forEach((step, index) => {
      step.textContent = locale === 'en' ? String(index + 1) : '一二三四五六'[index]!
    })
  }
  selector.addEventListener('change', () => {
    setLocale(selector.value === 'en' ? 'en' : 'zh-Hant')
    selector.blur()
  })
  subscribe(render)
  render()
}
