import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTheme } from './utils/theme'
import { triggerLayoutReflow } from './utils/layout-reflow'

initTheme()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')
const root = createRoot(rootEl)

async function bootstrap() {
  try {
    await ((document as Document).fonts?.ready ?? Promise.resolve())
  } catch (err) {
    console.error('[bootstrap] Font preload failed:', err)
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    if (isTauri()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().show()
      triggerLayoutReflow()
    }
  } catch {
    /* browser/dev mode */
  }
}

void bootstrap()
