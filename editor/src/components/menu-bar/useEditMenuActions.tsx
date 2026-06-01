import { useMemo } from 'react'
import type { Dispatch } from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import type { Action as EditorAction, CoreState } from '../../store/editor-store'
import { canRedoProject, canUndoProject } from '../../store/project-history'
import type { FileMenuItem } from './FileMenu'

interface UseEditMenuActionsParams {
  state: CoreState
  dispatch: Dispatch<EditorAction>
  closeMenu: () => void
}

export function useEditMenuActions({
  state,
  dispatch,
  closeMenu,
}: UseEditMenuActionsParams) {
  const editItems: FileMenuItem[] = useMemo(() => {
    const undoEnabled = canUndoProject(state)
    const redoEnabled = canRedoProject(state)
    return [
      {
        label: 'Undo',
        icon: <Undo2 size={12} />,
        shortcut: 'Ctrl+Z',
        action: () => {
          if (undoEnabled) dispatch({ type: 'PROJECT_UNDO' })
          closeMenu()
        },
      },
      {
        label: 'Redo',
        icon: <Redo2 size={12} />,
        shortcut: 'Ctrl+Shift+Z',
        action: () => {
          if (redoEnabled) dispatch({ type: 'PROJECT_REDO' })
          closeMenu()
        },
      },
    ]
  }, [state, dispatch, closeMenu])

  return { editItems, undoEnabled: canUndoProject(state), redoEnabled: canRedoProject(state) }
}
