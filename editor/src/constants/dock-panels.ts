// ---------------------------------------------------------------------------
// dock-panels — bottom dock panel ids, order, labels, defaults
// ---------------------------------------------------------------------------

export type DockPanelId = 'console' | 'timeline' | 'events'

export type DockPanelDockState = 'docked' | 'hidden' | 'floating'

export type DockPanelDockStateMap = Record<DockPanelId, DockPanelDockState>

export type DockPanelVisibility = Record<DockPanelId, boolean>

export const DOCK_PANEL_ORDER: readonly DockPanelId[] = [
  'console',
  'timeline',
  'events',
] as const

export const DEFAULT_DOCK_PANEL_VISIBILITY: DockPanelVisibility = {
  console: true,
  timeline: false,
  events: false,
}

export const DEFAULT_DOCK_PANEL_STATE: DockPanelDockStateMap = {
  console: 'docked',
  timeline: 'hidden',
  events: 'hidden',
}

export const DOCK_PANEL_LABELS: Record<DockPanelId, string> = {
  console: 'Debug Console',
  timeline: 'Animation Timeline',
  events: 'Event Debugger',
}

export const DOCK_VISIBILITY_STORAGE_KEY = 'artcade.dock-panels-v2'

export function countVisibleDockPanels(visibility: DockPanelVisibility): number {
  return DOCK_PANEL_ORDER.filter((id) => visibility[id]).length
}
