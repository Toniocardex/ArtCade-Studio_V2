import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loader } from '@monaco-editor/react'
import './index.css'
import './utils/monaco-setup'   // loader.config({monaco}) + worker (must precede loader.init)
import App from './App'
import { initTheme } from './utils/theme'

initTheme()   // set data-theme before first paint (no flash)

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')
const root = createRoot(rootEl)

// ---------------------------------------------------------------------------
// Coordinated bootstrap (zero-flicker).
// The Tauri window starts hidden ("visible": false). We pre-warm Monaco and
// wait for the monospace fonts to be resolved BEFORE the first React render,
// then reveal the OS window — so the editor's pixels are already correct on
// the first visible frame (no collapsed/reflow flash).
// ---------------------------------------------------------------------------
async function bootstrap() {
  try {
    await Promise.all([
      loader.init(),                                  // Monaco core + workers
      (document as Document).fonts?.ready ?? Promise.resolve(),
    ])
  } catch {
    /* never block the UI on pre-warm */
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // Reveal the native window only once React + Monaco are ready.
  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    if (isTauri()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().show()
    }
  } catch {
    /* browser/dev mode: nothing to show */
  }
}

void bootstrap()
