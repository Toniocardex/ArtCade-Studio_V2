// ---------------------------------------------------------------------------
// Logic Board rule list — scroll/focus helpers (DOM, visual editor only).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'

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

export type LogicEventNavDirection = 'up' | 'down'

/** Events on the board that owns the focused rule, else the active board. */
export function navigableBoardEvents(
  sceneBoards: readonly LogicBoard[],
  activeBoard: LogicBoard | null,
  focusedEventId: string | null,
): LogicEvent[] {
  if (focusedEventId) {
    for (const b of sceneBoards) {
      if (b.events.some((e) => e.id === focusedEventId)) return b.events
    }
  }
  return activeBoard?.events ?? []
}

export function siblingEventId(
  events: readonly LogicEvent[],
  currentId: string | null,
  direction: LogicEventNavDirection,
): string | null {
  if (events.length === 0) return null
  const idx =
    currentId == null
      ? -1
      : events.findIndex((e) => e.id === currentId)
  if (idx < 0) {
    return direction === 'down' ? events[0]!.id : events[events.length - 1]!.id
  }
  const next = direction === 'down' ? idx + 1 : idx - 1
  if (next < 0 || next >= events.length) return events[idx]!.id
  return events[next]!.id
}

/** Prefer the rule at the same index after removal, else the previous one. */
export function focusIdAfterDelete(
  events: readonly LogicEvent[],
  deletedId: string,
): string | null {
  const idx = events.findIndex((e) => e.id === deletedId)
  if (idx < 0) return null
  const remaining = events.filter((e) => e.id !== deletedId)
  if (remaining.length === 0) return null
  return remaining[Math.min(idx, remaining.length - 1)]!.id
}
