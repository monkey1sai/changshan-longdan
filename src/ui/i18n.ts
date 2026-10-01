import type { MoveId } from '../combat/moves.ts'

export type Locale = 'zh-Hant' | 'en'
export type TranslationParams = Record<string, string | number>

const zhHant = {
  'battle.opening': '魏軍列陣',
  'battle.pressure': '敵軍壓上！',
  'battle.surge': '攻勢加劇！',
  'battle.finale': '最後包圍！',
  'hud.style': '龍膽槍法',
  'hud.guard': '架槍守勢',
  'hud.officer': '魏軍隊長',
  'result.victory': '完全勝利',
  'result.defeat': '趙雲 敗走',
  'result.ko': '擊破數',
  'result.maxCombo': '最大連擊',
  'result.time': '戰鬥時間',
  'result.damage': '受到傷害',
  'result.rank': '評價',
  'guide.dead': '趙雲敗走 · 結算後按 Enter 再戰',
  'guide.hurt': '受擊中 · 待起身後閃避脫離敵陣',
  'guide.musou': '蒼龍破陣 · 移動將敵兵捲入龍膽亂舞',
  'guide.counter': '精準格擋！ J／□ 反擊震飛',
  'guide.guard': '正面防禦 · 迎擊瞬間按 F／L1 可反擊',
  'guide.dodge': 'J／□ 接突進斬 · 迅速切入敵陣',
  'guide.jump': 'J／□ 俯衝落地 · K／△ 空中橫掃',
  'guide.move': '按住 J／□ 連段 · K／△ 挑空 · Shift → J 突進',
  'guide.normalCharge': 'K／△ {move} · {purpose}',
  'guide.followUp': '{purpose} · Shift／R1 閃避銜接',
  'purpose.N1': '直刺起手', 'purpose.N2': '橫掃前方', 'purpose.N3': '回身掃擊',
  'purpose.N4': '雙重突刺', 'purpose.N5': '旋槍清兵', 'purpose.N6': '貫穿擊飛',
  'purpose.C1': '挑起敵兵', 'purpose.C2': '挑空追擊', 'purpose.C3': '空中連打',
  'purpose.C4': '迴旋清兵', 'purpose.C5': '集中破甲', 'purpose.C6': '大範圍震飛',
  'purpose.JA': '俯衝落地', 'purpose.JC': '空中橫掃', 'purpose.MUSOU': '移動帶龍入陣',
  'purpose.DASH': '突進破陣', 'purpose.COUNTER': '反擊震飛',
  'move.N1': '刺', 'move.N2': '橫掃', 'move.N3': '回掃', 'move.N4': '雙突', 'move.N5': '旋槍', 'move.N6': '龍牙突',
  'move.C1': '挑槍', 'move.C2': '昇龍', 'move.C3': '追龍', 'move.C4': '迴龍掃', 'move.C5': '百烈槍', 'move.C6': '天龍破',
  'move.JA': '落鳳', 'move.JC': '旋空', 'move.DASH': '疾風突', 'move.COUNTER': '龍膽返', 'move.MUSOU': '蒼龍破陣',
} as const

export type TranslationKey = keyof typeof zhHant

const en: Record<TranslationKey, string> = {
  'battle.opening': 'Wei troops assemble',
  'battle.pressure': 'The enemy advances!',
  'battle.surge': 'The assault intensifies!',
  'battle.finale': 'The final encirclement!',
  'hud.style': 'Dragon Spear Style', 'hud.guard': 'Guard Stance', 'hud.officer': 'Wei Captain',
  'result.victory': 'Complete Victory', 'result.defeat': 'Zhao Yun Has Fallen',
  'result.ko': 'KOs', 'result.maxCombo': 'Max Combo', 'result.time': 'Battle Time', 'result.damage': 'Damage Taken', 'result.rank': 'Rank',
  'guide.dead': 'Zhao Yun has fallen · Press Enter after results to fight again',
  'guide.hurt': 'Hit stunned · Dodge away after recovering',
  'guide.musou': 'Azure Dragon Assault · Move to pull foes into the spear storm',
  'guide.counter': 'Perfect guard! J / Square to counterblast',
  'guide.guard': 'Block from the front · Press F / L1 as the strike lands to counter',
  'guide.dodge': 'Press J / Square for a dash strike · Cut into the enemy line',
  'guide.jump': 'J / Square dive · K / Triangle aerial sweep',
  'guide.move': 'Hold J / Square for combos · K / Triangle launches · Shift then J dashes',
  'guide.normalCharge': 'K / Triangle {move} · {purpose}', 'guide.followUp': '{purpose} · Shift / R1 to dodge-cancel',
  'purpose.N1': 'Opening thrust', 'purpose.N2': 'Front sweep', 'purpose.N3': 'Turning sweep',
  'purpose.N4': 'Double thrust', 'purpose.N5': 'Crowd-clearing spin', 'purpose.N6': 'Piercing launch',
  'purpose.C1': 'Launch foes', 'purpose.C2': 'Rising pursuit', 'purpose.C3': 'Aerial barrage',
  'purpose.C4': 'Spinning crowd clear', 'purpose.C5': 'Armor-breaking barrage', 'purpose.C6': 'Wide shockwave launch',
  'purpose.JA': 'Diving strike', 'purpose.JC': 'Aerial sweep', 'purpose.MUSOU': 'Lead the dragon through the ranks',
  'purpose.DASH': 'Break formation', 'purpose.COUNTER': 'Counterblast',
  'move.N1': 'Thrust', 'move.N2': 'Sweep', 'move.N3': 'Reverse Sweep', 'move.N4': 'Double Thrust', 'move.N5': 'Spear Spin', 'move.N6': 'Dragon Fang Thrust',
  'move.C1': 'Rising Spear', 'move.C2': 'Rising Dragon', 'move.C3': 'Dragon Pursuit', 'move.C4': 'Dragon Wheel', 'move.C5': 'Hundred Spear Barrage', 'move.C6': 'Heavenly Dragon Break',
  'move.JA': 'Falling Phoenix', 'move.JC': 'Sky Spin', 'move.DASH': 'Gale Thrust', 'move.COUNTER': 'Dragon Gall Return', 'move.MUSOU': 'Azure Dragon Assault',
}

export const translations: Record<Locale, Record<TranslationKey, string>> = { 'zh-Hant': zhHant, en }
const STORAGE_KEY = 'changshan-longdan.locale'
const listeners = new Set<(locale: Locale) => void>()
let locale: Locale = readStoredLocale()

function readStoredLocale(): Locale {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh-Hant'
  } catch {
    return 'zh-Hant'
  }
}

export function getLocale(): Locale {
  return locale
}

export function setLocale(next: Locale): void {
  const changed = locale !== next
  locale = next
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next)
  } catch {
    // 儲存空間被封鎖時仍維持本次工作階段的語系。
  }
  if (changed) for (const listener of listeners) listener(locale)
}

export function subscribe(listener: (locale: Locale) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function t(key: TranslationKey, params: TranslationParams = {}): string {
  return translations[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function moveName(id: MoveId): string {
  return t(`move.${id}` as TranslationKey)
}

/** 供尚未納入字典的靜態 DOM 暫時依目前語系選字。 */
export function translate(zh: string, english: string): string {
  return locale === 'en' ? english : zh
}

export function isTranslationKey(value: string): value is TranslationKey {
  return value in zhHant
}
