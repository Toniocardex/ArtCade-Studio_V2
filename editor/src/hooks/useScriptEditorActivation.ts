import { useEffect, useRef } from 'react'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../store/editor-store'
import { applyScriptEditorActivation } from '../utils/script-editor-activation'

/**
 * Keeps Script Editor focused on main.lua or the selected entity script.
 * ui-reducer SET_MODE handles the synchronous path; this hook loads scripts from disk.
 */
export function useScriptEditorActivation(): void {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const mode = useEditorSelector((state) => state.mode)
  const selectionEntityId = useEditorSelector((state) => state.selection.entityId)
  const openScriptPathsKey = useEditorSelector((state) =>
    state.openScripts.map((script) => script.path).join('\0'),
  )
  const activeScriptPath = useEditorSelector((state) => state.activeScriptPath)
  const projectLoadEpoch = useEditorSelector((state) => state.projectLoadEpoch)
  const prevModeRef = useRef(mode)
  const prevSelectionRef = useRef(selectionEntityId)

  useEffect(() => {
    const enteredScriptMode = prevModeRef.current !== 'script' && mode === 'script'
    const selectionChanged = prevSelectionRef.current !== selectionEntityId
    prevModeRef.current = mode
    prevSelectionRef.current = selectionEntityId

    if (mode !== 'script') return

    const preferSelection = enteredScriptMode || selectionChanged
    let cancelled = false

    applyScriptEditorActivation(
      store.getState(),
      dispatch,
      { preferSelection },
      () => cancelled,
    )

    return () => {
      cancelled = true
    }
  }, [
    mode,
    selectionEntityId,
    openScriptPathsKey,
    activeScriptPath,
    projectLoadEpoch,
    dispatch,
    store,
  ])
}
