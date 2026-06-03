// ---------------------------------------------------------------------------
// useRuntimeReadiness — single subscription for WASM vs Editor API readiness
// ---------------------------------------------------------------------------
//
// WASM `isReady()` means the module loaded; `runtimeSync.isEngineReady()` means
// the Editor API bridge wired (grid, guides, entity pick). Consumers must not
// conflate the two — see PreviewPanel grid regression (2026-06).

import { useCallback, useEffect, useState } from 'react'
import { isReady as isWasmReady } from '../utils/wasm-bridge'
import { runtimeSync } from '../utils/runtime-sync-service'

export type RuntimeReadiness = {
  wasmReady: boolean
  engineReady: boolean
  /** Mount/HMR path when the wasm singleton is alive before React onReady fires. */
  syncWasmFromBridge: () => void
}

export function useRuntimeReadiness(): RuntimeReadiness {
  const [wasmReady, setWasmReady] = useState(() => isWasmReady())
  const [engineReady, setEngineReady] = useState(() => runtimeSync.isEngineReady())

  useEffect(() => runtimeSync.onReadyChange(setWasmReady), [])
  useEffect(() => runtimeSync.onEngineReadyChange(setEngineReady), [])

  const syncWasmFromBridge = useCallback(() => {
    if (!isWasmReady()) return
    setWasmReady((w) => (w ? w : true))
  }, [])

  return { wasmReady, engineReady, syncWasmFromBridge }
}
