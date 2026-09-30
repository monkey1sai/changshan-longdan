import type { RoutingRequest } from './jev-routing.ts'

export const CONTEXT_VARIANTS = ['compact', 'structured_dom', 'page_text'] as const
export type ContextVariant = typeof CONTEXT_VARIANTS[number]
export interface PageContext {
  title: string
  subtitle: string
  startButton: { role: string; name: string; enabled: boolean }
  startPrompt: string
  controlRows: string[][]
  renderedText: string
}

/** Read observed title-page UI only; no HTML, scripts, cookies or input values. */
export function capturePageContext(doc: Document): PageContext {
  const title = doc.getElementById('title')
  const start = doc.getElementById('start') as HTMLButtonElement | null
  if (!title || title.hidden || !start || !start.getClientRects().length) {
    throw new Error('Title page is not available for context capture')
  }
  const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const controlRows = [...title.querySelectorAll('.controls tr')].slice(1)
    .map(row => [...row.querySelectorAll('td')].map(text))
  if (controlRows.length === 0 || !text(start)) throw new Error('Missing title UI evidence')
  return {
    title: text(title.querySelector('h1')),
    subtitle: text(title.querySelector('.subtitle')),
    startButton: { role: 'button', name: text(start), enabled: !start.disabled },
    startPrompt: text(title.querySelector('.prompt')),
    controlRows,
    // innerText includes rendered content inside the scrollable panel, including below the fold.
    renderedText: title.innerText,
  }
}

/** Keep questions, choices, goal and state identical across evidence variants. */
export function withPageContext(request: RoutingRequest, context: PageContext, variant: ContextVariant) {
  const copy = structuredClone(request)
  if (variant === 'compact') return copy
  const pageContext = variant === 'structured_dom' ? {
    title: context.title, subtitle: context.subtitle,
    startButton: structuredClone(context.startButton), startPrompt: context.startPrompt,
    controlRows: structuredClone(context.controlRows),
  } : { renderedText: context.renderedText }
  return { ...copy, state: { ...copy.state, pageContext } }
}
