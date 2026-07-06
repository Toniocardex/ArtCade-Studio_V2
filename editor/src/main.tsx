import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// ArtCade UI font — JetBrains Mono (EDITOR_MOCKUP_TOKENS.md). Offline-safe via fontsource.
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'

import './index.css'
import App from './App'
import RuntimePreviewApp from './runtime-preview/RuntimePreviewApp'
import { BootErrorBoundary } from './components/BootErrorBoundary'
import { initTheme } from './utils/theme'
import { applyTauriWindowSurfaceIfNeeded } from './utils/boot-chrome'
import { ensureRuntimeCanvasForWasmBoot } from './utils/runtime-canvas'
import { installBootDiagnosticsTap } from './utils/boot-diagnostics'
import { installEditorKeyboardGuards } from './utils/keyboard'
import { isRuntimePreviewRoute } from './utils/runtime-preview-window'
import { installSpritesheetPreviewCallback } from './utils/spritesheet-preview-bridge'

const bootTheme = initTheme()
const runtimePreviewRoute = isRuntimePreviewRoute()
if (!runtimePreviewRoute) {
  installEditorKeyboardGuards()
  installSpritesheetPreviewCallback()
}
applyTauriWindowSurfaceIfNeeded(bootTheme)
if (!runtimePreviewRoute) {
  installBootDiagnosticsTap()
  ensureRuntimeCanvasForWasmBoot()
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')
const root = createRoot(rootEl)

function bootstrap() {
  root.render(
    <BootErrorBoundary>
      <StrictMode>
        {runtimePreviewRoute ? <RuntimePreviewApp /> : <App />}
      </StrictMode>
    </BootErrorBoundary>,
  )
}

bootstrap()
