// ---------------------------------------------------------------------------
// Logic Board rule list — scroll/focus helpers (DOM, visual editor only).
// ---------------------------------------------------------------------------

export const LOGIC_EVENTS_LIST_SELECTOR = '[data-logic-events-list]'
export const logicEventCardSelector = (eventId: string) =>
  `[data-logic-event-id="${eventId}"]`

/** Scroll a rule card into the Logic Board events list viewport. */
export function scrollEventCardIntoView(eventId: string | null | undefined): void {
  if (!eventId || globalThis.document === undefined) return
  const el = globalThis.document.querySelector(logicEventCardSelector(eventId))
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

/** Run scroll after React commits focus/editing state. */
export function scrollEventCardIntoViewSoon(eventId: string | null | undefined): void {
  if (!eventId) return
  requestAnimationFrame(() => scrollEventCardIntoView(eventId))
}
