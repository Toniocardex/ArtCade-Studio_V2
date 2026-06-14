import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEditorSelector } from '../store/editor-store'
import { runtimeSync } from '../utils/runtime-sync-service'
import { scheduleBootIdleTask } from '../utils/boot-idle'
import { useRuntimeReadiness } from './useRuntimeReadiness'
const BOOT_TIMEOUT_MS = 20_000

export interface EditorBootReadyState {
  ready: boolean
  timedOut: boolean
  statusLine: string
  retry: () => void
}

function buildStatusLine(opts: {
  project: boolean
  wasm: boolean
  engine: boolean
  synced: boolean
  fonts: boolean
  idle: boolean
}): string {
  const parts: string[] = []
  if (!opts.project) parts.push('project')
  if (!opts.wasm) parts.push('runtime')
  if (!opts.engine) parts.push('editor API')
  if (!opts.synced) parts.push('scene sync')
  if (!opts.fonts) parts.push('fonts')
  if (!opts.idle) parts.push('init')
  if (parts.length === 0) return 'Starting…'
  return `Loading ${parts.join(', ')}…`
}

export function useEditorBootReady(): EditorBootReadyState {
  const projectReady = useEditorSelector((s) => s.project != null)
  const { wasmReady, engineReady } = useRuntimeReadiness()
  const [synced, setSynced] = useState(() => runtimeSync.isBootProjectSynced())
  const [fontsReady, setFontsReady] = useState(false)
  const [idleReady, setIdleReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    return runtimeSync.onBootProjectSyncedChange(setSynced)
  }, [])

  // Track C — defer non-blocking boot bookkeeping until the main thread is idle.
  useEffect(() => scheduleBootIdleTask(() => setIdleReady(true)), [])

  useEffect(() => {
    let cancelled = false
    const fonts = document.fonts?.ready ?? Promise.resolve()
    void fonts.finally(() => {
      if (!cancelled) setFontsReady(true)
    })
    return () => { cancelled = true }
  }, [])

  const ready =
    projectReady && wasmReady && engineReady && synced && fontsReady && idleReady

  const statusLine = useMemo(
    () => buildStatusLine({
      project: projectReady,
      wasm: wasmReady,
      engine: engineReady,
      synced,
      fonts: fontsReady,
      idle: idleReady,
    }),
    [projectReady, wasmReady, engineReady, synced, fontsReady, idleReady],
  )

  // Watchdog for stuck WASM/EditorAPI sync — not a race-condition workaround.
  useEffect(() => {
    if (ready) {
      setTimedOut(false)
      return undefined
    }
    const t = globalThis.setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS)
    return () => globalThis.clearTimeout(t)
  }, [ready])

  const retry = useCallback(() => {
    setTimedOut(false)
    globalThis.location.reload()
  }, [])

  return { ready, timedOut, statusLine, retry }
}
