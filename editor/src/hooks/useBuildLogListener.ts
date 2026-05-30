// ---------------------------------------------------------------------------
// useBuildLogListener — Tauri build-log stream → store LOG entries.
// Lives on BottomDock (always mounted) so build output is captured even when
// the Console tab is hidden or another tab is active.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useConsoleLogs } from '../store/editor-store'
import type { ConsoleLevel } from '../types'

export function useBuildLogListener(): void {
  const { dispatch } = useConsoleLogs()

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let unlisten: (() => void) | null = null

    listen<{ message: string; level: string }>('build-log', event => {
      if (cancelled) return
      const raw = event.payload
      const level = (['info', 'warn', 'error', 'lua'] as ConsoleLevel[]).includes(
        raw.level as ConsoleLevel,
      ) ? (raw.level as ConsoleLevel) : 'info'

      dispatch({
        type: 'LOG',
        entry: {
          id:      Date.now() + Math.random(),
          time:    new Date().toLocaleTimeString('it-IT', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }),
          message: raw.message,
          level,
        },
      })
    }).then(fn => {
      if (cancelled) fn()
      else unlisten = fn
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [dispatch])
}
