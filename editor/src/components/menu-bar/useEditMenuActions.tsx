import { useMemo } from 'react'
import type { Dispatch } from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import type { Action as EditorAction } from '../../store/editor-store'
import type { FileMenuItem } from './FileMenu'

interface UseEditMenuActionsParams {
  undoEnabled: boolean
  redoEnabled: boolean
  dispatch: Dispatch<EditorAction>
  closeMenu: () => void
}

export function useEditMenuActions({
  undoEnabled,
  redoEnabled,
  dispatch,
  closeMenu,
}: UseEditMenuActionsParams) {
  const editItems: FileMenuItem[] = useMemo(() => {
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
  }, [undoEnabled, redoEnabled, dispatch, closeMenu])

  return { editItems }
}
