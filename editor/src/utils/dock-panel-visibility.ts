import {
  DEFAULT_DOCK_PANEL_VISIBILITY,
  DOCK_PANEL_ORDER,
  DOCK_VISIBILITY_STORAGE_KEY,
  type DockPanelId,
  type DockPanelVisibility,
} from '../constants/dock-panels'
import { normalizeDockPanelVisibility } from './dock-ui-state'

function isDockPanelId(value: unknown): value is DockPanelId {
  return (
    value === 'console' ||
    value === 'timeline' ||
    value === 'logic' ||
    value === 'events'
  )
}

function parseStoredVisibility(raw: string | null): DockPanelVisibility | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    const next = { ...DEFAULT_DOCK_PANEL_VISIBILITY }
    let ok = false
    for (const id of DOCK_PANEL_ORDER) {
      const raw = o[id]
      if (isDockPanelId(id) && typeof raw === 'boolean') {
        next[id] = raw
        ok = true
      }
    }
    return ok ? normalizeDockPanelVisibility(next) : null
  } catch {
    return null
  }
}

export function readStoredDockPanelVisibility(): DockPanelVisibility {
  try {
    const stored =
      parseStoredVisibility(localStorage.getItem(DOCK_VISIBILITY_STORAGE_KEY)) ??
      DEFAULT_DOCK_PANEL_VISIBILITY
    return normalizeDockPanelVisibility(stored)
  } catch {
    return { ...DEFAULT_DOCK_PANEL_VISIBILITY }
  }
}

export function persistDockPanelVisibility(visibility: DockPanelVisibility): void {
  try {
    localStorage.setItem(
      DOCK_VISIBILITY_STORAGE_KEY,
      JSON.stringify(normalizeDockPanelVisibility(visibility)),
    )
  } catch {
    /* ignore quota / private mode */
  }
}
