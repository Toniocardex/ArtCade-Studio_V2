import { useEffect } from 'react'
import { useEditor } from '../store/editor-store'
import { syncLogicBoardFromProject } from '../utils/sync-logic-board-script'

/** Compile logic boards into main script after every LOAD_PROJECT. */
export function useProjectLogicBoardSync(): void {
  const { state, dispatch } = useEditor()

  useEffect(() => {
    syncLogicBoardFromProject(dispatch, state, { activate: false })
    // Re-run only on project load, not on every board edit (LogicBoardPanel handles that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.projectLoadEpoch])
}
