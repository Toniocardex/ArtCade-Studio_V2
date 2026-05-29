import { paintDocumentChrome, applyTauriWindowSurface } from './boot-chrome'

// ---------------------------------------------------------------------------
// Theme (Phase E) — Dark (default) / Light.
//
// Colours live as CSS custom properties in index.css; switching the
// `data-theme` attribute on <html> repaints the whole editor. The choice is
// persisted in localStorage; first run falls back to prefers-color-scheme.
// Surface hex/RGB for boot: editor/boot-surfaces.json (+ sync-boot-chrome).
// The PreviewPanel canvas is C++/WASM-rendered and unaffected.
// ---------------------------------------------------------------------------

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'artcade-theme'

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

/** Stored choice → prefers-color-scheme → 'dark' default. */
export function resolveInitialTheme(): Theme {
  const stored = getStoredTheme()
  if (stored) return stored
  try {
    if (globalThis.matchMedia('(prefers-color-scheme: light)').matches)
      return 'light'
  } catch {
    /* matchMedia unavailable → fall through */
  }
  return 'dark'
}

/** Apply a theme to <html> and persist it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage blocked → still applied for this session */
  }
  paintDocumentChrome(theme)
  applyTauriWindowSurface(theme)
}

export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark'
}

/** Call once at startup, before React renders, to avoid a flash. */
export function initTheme(): Theme {
  const t = resolveInitialTheme()
  document.documentElement.dataset.theme = t
  paintDocumentChrome(t)
  return t
}
