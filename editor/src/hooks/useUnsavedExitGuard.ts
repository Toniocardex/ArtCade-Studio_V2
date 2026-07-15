// ---------------------------------------------------------------------------
// useUnsavedExitGuard — block window close when authoring is dirty
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEditorDispatch, useEditorStore } from '../store/editor-store'
import { useProjectNamePersist } from '../components/menu-bar/project-name-context'
import {
  hasUnsavedAuthoring,
  resolveUnsavedGuard,
} from '../utils/unsaved-guard'

/**
 * Tauri: CloseRequested → Save All / Discard / Cancel.
 * Web: beforeunload native prompt when dirty (browser cannot show Save All).
 */
export function useUnsavedExitGuard(): void {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const { flushBeforePersist } = useProjectNamePersist()

  useEffect(() => {
    if (!isTauri()) {
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!hasUnsavedAuthoring(store.getState())) return
        event.preventDefault()
        event.returnValue = ''
      }
      window.addEventListener('beforeunload', onBeforeUnload)
      return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }

    let cancelled = false
    let unlisten: (() => void) | undefined

    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        const state = store.getState()
        if (!hasUnsavedAuthoring(state)) return
        event.preventDefault()
        const ok = await resolveUnsavedGuard({
          state,
          actionLabel: 'Closing the editor will lose unsaved work unless you Save All.',
          dispatch,
          flushBeforePersist,
        })
        if (!ok || cancelled) return
        await getCurrentWindow().destroy()
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [dispatch, flushBeforePersist, store])
}
