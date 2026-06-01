// ---------------------------------------------------------------------------
// dock-panels — bottom dock panel ids, order, labels, defaults
// ---------------------------------------------------------------------------

export type DockPanelId = 'console' | 'timeline' | 'logic' | 'events'

export type DockPanelVisibility = Record<DockPanelId, boolean>

export const DOCK_PANEL_ORDER: readonly DockPanelId[] = [
  'console',
  'timeline',
  'logic',
  'events',
] as const

export const DEFAULT_DOCK_PANEL_VISIBILITY: DockPanelVisibility = {
  console: true,
  timeline: false,
  logic: true,
  events: false,
}

export const DOCK_PANEL_LABELS: Record<DockPanelId, string> = {
  console: 'Debug Console',
  timeline: 'Animation Timeline',
  logic: 'Logic Preview',
  events: 'Event Debugger',
}

export const DOCK_VISIBILITY_STORAGE_KEY = 'artcade.dock-panels-v1'

export function countVisibleDockPanels(visibility: DockPanelVisibility): number {
  return DOCK_PANEL_ORDER.filter((id) => visibility[id]).length
}
