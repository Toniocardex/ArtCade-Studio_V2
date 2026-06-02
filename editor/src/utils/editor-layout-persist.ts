// ---------------------------------------------------------------------------
// editor-layout-persist — per-resolution layout snapshots (Phase 3)
// ---------------------------------------------------------------------------

import {
  CANVAS_MIN_WIDTH,
  LAYOUT_STORAGE_PREFIX,
  PANEL_LEFT_MAX,
  PANEL_LEFT_MIN,
  PANEL_LEFT_SNAP,
  PANEL_RIGHT_MAX,
  PANEL_RIGHT_MIN,
} from '../constants/editor-layout-persist'
import {
  EDITOR_DOCK_H_DEFAULT,
  EDITOR_LEFT_W_DEFAULT,
  EDITOR_RIGHT_W_DEFAULT,
} from '../constants/editor-layout'
import type { DockPanelVisibility } from '../constants/dock-panels'
import { readStoredDockPanelVisibility } from './dock-panel-visibility'

export type EditorLayoutSnapshot = {
  leftW: number
  rightW: number
  dockH: number
  dockCollapsed: boolean
}

export function layoutStorageKey(width: number, height: number): string {
  return `${LAYOUT_STORAGE_PREFIX}${Math.round(width)}x${Math.round(height)}`
}

export function readLayoutBucketSize(): { width: number; height: number } {
  if (globalThis.window === undefined) {
    return { width: 1920, height: 1080 }
  }
  return {
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
  }
}

function snapPanelWidth(value: number): number {
  let best = value
  let bestDist = Number.POSITIVE_INFINITY
  for (const snap of PANEL_LEFT_SNAP) {
    const dist = Math.abs(snap - value)
    if (dist < bestDist && dist <= 12) {
      bestDist = dist
      best = snap
    }
  }
  return best
}

export function clampLeftWidth(value: number): number {
  const clamped = Math.min(PANEL_LEFT_MAX, Math.max(PANEL_LEFT_MIN, Math.round(value)))
  return snapPanelWidth(clamped)
}

export function clampRightWidth(value: number): number {
  return Math.min(PANEL_RIGHT_MAX, Math.max(PANEL_RIGHT_MIN, Math.round(value)))
}

const SIDE_RESIZE_CHROME_PX = 8

/** Keep at least CANVAS_MIN_WIDTH for the center column when sidebars are visible. */
export function clampLeftWidthInWorkspace(
  value: number,
  workspaceWidth: number,
  rightWidth: number,
): number {
  const maxLeft = workspaceWidth - rightWidth - CANVAS_MIN_WIDTH - SIDE_RESIZE_CHROME_PX
  return clampLeftWidth(Math.min(value, maxLeft))
}

export function clampRightWidthInWorkspace(
  value: number,
  workspaceWidth: number,
  leftWidth: number,
): number {
  const maxRight = workspaceWidth - leftWidth - CANVAS_MIN_WIDTH - SIDE_RESIZE_CHROME_PX
  return clampRightWidth(Math.min(value, maxRight))
}

export function defaultLayoutSnapshot(): EditorLayoutSnapshot {
  return {
    leftW: EDITOR_LEFT_W_DEFAULT,
    rightW: EDITOR_RIGHT_W_DEFAULT,
    dockH: EDITOR_DOCK_H_DEFAULT,
    dockCollapsed: false,
  }
}

function migrateLegacyWidths(): Partial<EditorLayoutSnapshot> | null {
  if (globalThis.localStorage === undefined) return null
  const leftRaw = globalThis.localStorage.getItem('artcade.sidebar-left-w-v3')
  const rightRaw = globalThis.localStorage.getItem('artcade.sidebar-right-w-v3')
  const dockRaw = globalThis.localStorage.getItem('artcade.bottom-dock-h-v5')
  if (!leftRaw && !rightRaw && !dockRaw) return null
  const partial: Partial<EditorLayoutSnapshot> = {}
  if (leftRaw) {
    const n = Number(leftRaw)
    if (Number.isFinite(n)) partial.leftW = clampLeftWidth(n)
  }
  if (rightRaw) {
    const n = Number(rightRaw)
    if (Number.isFinite(n)) partial.rightW = clampRightWidth(n)
  }
  if (dockRaw) {
    const n = Number(dockRaw)
    if (Number.isFinite(n)) partial.dockH = Math.round(n)
  }
  return partial
}

export function readEditorLayoutSnapshot(
  width: number,
  height: number,
): EditorLayoutSnapshot {
  const defaults = defaultLayoutSnapshot()
  if (globalThis.localStorage === undefined) return defaults

  const key = layoutStorageKey(width, height)
  const raw = globalThis.localStorage.getItem(key)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<EditorLayoutSnapshot>
      return {
        leftW: clampLeftWidth(parsed.leftW ?? defaults.leftW),
        rightW: clampRightWidth(parsed.rightW ?? defaults.rightW),
        dockH: Math.round(parsed.dockH ?? defaults.dockH),
        dockCollapsed: parsed.dockCollapsed === true,
      }
    } catch {
      return defaults
    }
  }

  const legacy = migrateLegacyWidths()
  if (legacy) {
    return {
      leftW: legacy.leftW ?? defaults.leftW,
      rightW: legacy.rightW ?? defaults.rightW,
      dockH: legacy.dockH ?? defaults.dockH,
      dockCollapsed: legacy.dockCollapsed ?? defaults.dockCollapsed,
    }
  }

  return defaults
}

export function writeEditorLayoutSnapshot(
  width: number,
  height: number,
  snapshot: EditorLayoutSnapshot,
): void {
  if (globalThis.localStorage === undefined) return
  const key = layoutStorageKey(width, height)
  globalThis.localStorage.setItem(key, JSON.stringify(snapshot))
}

export function clearEditorLayoutSnapshot(width: number, height: number): void {
  if (globalThis.localStorage === undefined) return
  globalThis.localStorage.removeItem(layoutStorageKey(width, height))
}

/** Exposed for dock visibility merge when resetting layout. */
export function readDefaultDockVisibility(): DockPanelVisibility {
  return readStoredDockPanelVisibility()
}
