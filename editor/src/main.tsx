import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isTauri } from '@tauri-apps/api/core'

// ArtCade style guide fonts — IBM Plex Sans (UI) + JetBrains Mono (tech data).
// Imported here so Vite bundles them with the app (offline-safe for Tauri).
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

import './index.css'
import App from './App'
import { BootErrorBoundary } from './components/BootErrorBoundary'
import { initTheme } from './utils/theme'
import { applyTauriWindowSurfaceIfNeeded } from './utils/boot-chrome'
import { triggerLayoutReflow } from './utils/layout-reflow'
import { installEditorKeyboardGuards } from './utils/keyboard'
import { installSpritesheetPreviewCallback } from './utils/spritesheet-preview-bridge'

const bootTheme = initTheme()
installEditorKeyboardGuards()
installSpritesheetPreviewCallback()
applyTauriWindowSurfaceIfNeeded(bootTheme)

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')
const root = createRoot(rootEl)

function reflowInTauri(): void {
  if (isTauri()) triggerLayoutReflow()
}

function settleFontsThenReflow(): void {
  const fontsReady = document.fonts?.ready ?? Promise.resolve()
  void fontsReady
    .catch((err) => {
      console.error('[bootstrap] Font preload failed:', err)
    })
    .finally(reflowInTauri)
}

function bootstrap() {
  root.render(
    <BootErrorBoundary>
      <StrictMode>
        <App />
      </StrictMode>
    </BootErrorBoundary>,
  )

  reflowInTauri()
  settleFontsThenReflow()
}

bootstrap()
