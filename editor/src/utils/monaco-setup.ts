// ---------------------------------------------------------------------------
// Monaco offline setup.
//
// @monaco-editor/react loads Monaco from a CDN (cdn.jsdelivr.net) by default.
// Inside the packaged Tauri app there is no network / the CSP blocks it, so
// the Script Editor was stuck forever on "Loading …".
//
// Here we hand @monaco-editor/react the locally-bundled `monaco-editor`
// package (Vite bundles it) and wire its web worker through Vite's `?worker`
// import, so the editor works fully offline.
// ---------------------------------------------------------------------------

import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
// Vite turns this into a bundled Web Worker (no CDN, no separate file path).
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// We only use plain text + Lua (no built-in TS/JSON/CSS/HTML language
// services), so the generic editor worker is the only one required.
;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker() {
    return new EditorWorker()
  },
}

loader.config({ monaco })

export {}
