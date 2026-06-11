import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import surfaces from '../../boot-surfaces.json'
import type { Theme } from './theme'

type Surface = (typeof surfaces)['dark']

const SURFACES: Record<Theme, Surface> = surfaces

/** Same stack as `--font-ui` in index.css (splash + boot shell). */
export const BOOT_UI_FONT_FAMILY =
  "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"

/** Matches index.css + boot-surfaces.json — Tauri window / WebView chrome. */
export const THEME_SURFACE_RGB: Record<Theme, { red: number; green: number; blue: number }> = {
  dark:  { red: SURFACES.dark.red, green: SURFACES.dark.green, blue: SURFACES.dark.blue },
  light: { red: SURFACES.light.red, green: SURFACES.light.green, blue: SURFACES.light.blue },
}

export function surfaceHex(theme: Theme): string {
  return SURFACES[theme].bg
}

export function textHex(theme: Theme): string {
  return SURFACES[theme].text
}

function bootShellCss(theme: Theme): string {
  const bg = surfaceHex(theme)
  const text = textHex(theme)
  return (
    `html,body,#root{width:100%;height:100%;margin:0;padding:0;overflow:hidden;background:${bg};color:${text}}` +
    `#boot-shell{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:${bg};color:${text};font-family:${BOOT_UI_FONT_FAMILY};font-size:1.25rem;font-weight:700;letter-spacing:-0.02em;user-select:none}`
  )
}

/** Paint document chrome before React/CSS bundle (pairs with public/boot-theme-init.js). */
export function paintDocumentChrome(theme: Theme): void {
  const root = document.documentElement
  if (!root) return
  const bg = surfaceHex(theme)
  const text = textHex(theme)
  root.style.backgroundColor = bg
  root.style.color = text
  const el = document.getElementById('boot-chrome')
  if (el && 'textContent' in el && typeof (el as { textContent: unknown }).textContent === 'string') {
    ;(el as { textContent: string }).textContent = bootShellCss(theme)
  }
}

export function applyTauriWindowSurface(theme: Theme): void {
  if (!isTauri()) return
  const rgb = THEME_SURFACE_RGB[theme]
  void getCurrentWindow().setBackgroundColor({ ...rgb, alpha: 255 })
}

/** Boot-only: skip redundant IPC when boot-theme-init.js already painted the document. */
export function applyTauriWindowSurfaceIfNeeded(theme: Theme): void {
  if (!isTauri()) return
  const root = document.documentElement
  if (!root) return
  const targetBg = surfaceHex(theme)
  if (root.style.backgroundColor === targetBg) return
  applyTauriWindowSurface(theme)
}

/**
 * Show the Tauri window on the first browser paint after the splash commits.
 */
export function revealTauriWindowForSplash(): void {
  if (!isTauri()) return
  requestAnimationFrame(() => {
    void getCurrentWindow().show()
  })
}
