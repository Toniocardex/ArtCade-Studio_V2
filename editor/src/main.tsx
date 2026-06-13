import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// ArtCade UI font — JetBrains Mono (EDITOR_MOCKUP_TOKENS.md). Offline-safe via fontsource.
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'

import './index.css'
import App from './App'
import { BootErrorBoundary } from './components/BootErrorBoundary'
import { initTheme } from './utils/theme'
import { applyTauriWindowSurfaceIfNeeded } from './utils/boot-chrome'
import { installEditorKeyboardGuards } from './utils/keyboard'
import { installSpritesheetPreviewCallback } from './utils/spritesheet-preview-bridge'

const bootTheme = initTheme()
installEditorKeyboardGuards()
installSpritesheetPreviewCallback()
applyTauriWindowSurfaceIfNeeded(bootTheme)

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')
const root = createRoot(rootEl)

function bootstrap() {
  root.render(
    <BootErrorBoundary>
      <StrictMode>
        <App />
      </StrictMode>
    </BootErrorBoundary>,
  )
}

bootstrap()
