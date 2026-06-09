import { useEffect } from 'react'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../store/editor-store'
import { syncLogicBoardFromProject } from '../utils/sync-logic-board-script'

/** Compile logic boards into main script after every LOAD_PROJECT. */
export function useProjectLogicBoardSync(): void {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const projectLoadEpoch = useEditorSelector((s) => s.projectLoadEpoch)

  useEffect(() => {
    syncLogicBoardFromProject(dispatch, store.getState(), { activate: false })
    // Re-run only on project load, not on every board edit (LogicBoardPanel handles that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectLoadEpoch, dispatch, store])
}
