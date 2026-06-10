// ---------------------------------------------------------------------------
// editor-layout — workbench chrome dimensions (mirror :root CSS vars)
// ---------------------------------------------------------------------------

/** Parse "280px" → 280; falls back when SSR or unset. */
function pxFromCssVar(name: string, fallback: number): number {
  if (globalThis.document === undefined) return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback
}

export const EDITOR_LEFT_W_DEFAULT  = 280
export const EDITOR_RIGHT_W_DEFAULT = 320
export const EDITOR_DOCK_H_DEFAULT  = 300
export const EDITOR_TOP_CHROME_H_PX = 52

export function readEditorLeftWidthDefault(): number {
  return pxFromCssVar('--editor-left-w-default', EDITOR_LEFT_W_DEFAULT)
}

export function readEditorRightWidthDefault(): number {
  return pxFromCssVar('--editor-right-w-default', EDITOR_RIGHT_W_DEFAULT)
}

export function readEditorDockHeightDefault(): number {
  return pxFromCssVar('--editor-dock-h-default', EDITOR_DOCK_H_DEFAULT)
}
