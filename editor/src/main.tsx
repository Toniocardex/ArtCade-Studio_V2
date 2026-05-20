import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BootErrorBoundary } from './components/BootErrorBoundary'
import { initTheme } from './utils/theme'
import { triggerLayoutReflow } from './utils/layout-reflow'
import { installEditorKeyboardGuards } from './utils/keyboard'

initTheme()
installEditorKeyboardGuards()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')
const root = createRoot(rootEl)

async function bootstrap() {
  try {
    const fontsReady = (document as Document).fonts?.ready ?? Promise.resolve()
    await Promise.race([
      fontsReady,
      new Promise((resolve) => window.setTimeout(resolve, 2000)),
    ])
  } catch (err) {
    console.error('[bootstrap] Font preload failed:', err)
  }

  root.render(
    <BootErrorBoundary>
      <StrictMode>
        <App />
      </StrictMode>
    </BootErrorBoundary>,
  )

  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    if (isTauri()) triggerLayoutReflow()
  } catch {
    /* browser dev */
  }
}

void bootstrap()
