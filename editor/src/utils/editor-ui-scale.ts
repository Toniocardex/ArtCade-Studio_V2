// ---------------------------------------------------------------------------
// editor-ui-scale — persistence, auto-detect, stepping (Phase 1 adaptive layout)
// ---------------------------------------------------------------------------

import {
  EDITOR_UI_SCALE_DEFAULT,
  EDITOR_UI_SCALE_STORAGE_KEY,
  EDITOR_UI_SCALE_VALUES,
  type EditorUiScale,
} from '../constants/editor-ui-scale'

export function formatEditorUiScalePercent(scale: number): string {
  return `${Math.round(scale * 100)}%`
}

export function isEditorUiScale(value: number): value is EditorUiScale {
  return (EDITOR_UI_SCALE_VALUES as readonly number[]).includes(value)
}

export function clampToEditorUiScale(value: number): EditorUiScale {
  let best: EditorUiScale = EDITOR_UI_SCALE_DEFAULT
  let bestDist = Number.POSITIVE_INFINITY
  for (const step of EDITOR_UI_SCALE_VALUES) {
    const dist = Math.abs(step - value)
    if (dist < bestDist) {
      bestDist = dist
      best = step
    }
  }
  return best
}

/** First-run suggestion from workspace pixel size (silent auto-apply per ADAPTIVE_LAYOUT §8.1.3). */
export function suggestEditorUiScale(width: number, height: number): EditorUiScale {
  if (width >= 2560 && height >= 1440) return 1.15
  if (width >= 1920 && height >= 1080) return 1
  if (width >= 1600 && height >= 900) return 0.9
  if (width >= 1366 && height >= 768) return 0.85
  if (width >= 1280 && height >= 680) return 0.75
  return 0.75
}

export function readStoredEditorUiScale(): EditorUiScale | null {
  if (globalThis.localStorage === undefined) return null
  const raw = globalThis.localStorage.getItem(EDITOR_UI_SCALE_STORAGE_KEY)
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return isEditorUiScale(n) ? n : clampToEditorUiScale(n)
}

export function writeStoredEditorUiScale(scale: EditorUiScale): void {
  if (globalThis.localStorage === undefined) return
  globalThis.localStorage.setItem(EDITOR_UI_SCALE_STORAGE_KEY, String(scale))
}

export function resolveInitialEditorUiScale(width: number, height: number): EditorUiScale {
  return readStoredEditorUiScale() ?? suggestEditorUiScale(width, height)
}

export function stepEditorUiScale(current: EditorUiScale, direction: 1 | -1): EditorUiScale {
  const idx = EDITOR_UI_SCALE_VALUES.indexOf(current)
  const base = idx >= 0 ? idx : EDITOR_UI_SCALE_VALUES.indexOf(EDITOR_UI_SCALE_DEFAULT)
  const next = Math.min(EDITOR_UI_SCALE_VALUES.length - 1, Math.max(0, base + direction))
  return EDITOR_UI_SCALE_VALUES[next]!
}
