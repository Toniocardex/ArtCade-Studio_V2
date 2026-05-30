import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import { emptyDialogScript } from '../../utils/dialog/dialog-script'
import { alertDialog } from '../../utils/native-dialog'

export function openDialogEditorForId(
  dispatch: Dispatch<Action>,
  dialogs: Record<string, import('../../utils/dialog/dialog-script').DialogScript>,
  dialogId: string,
): void {
  const id = dialogId.trim()
  if (!id) {
    void alertDialog('Set a Dialog ID on this component first.', {
      title: 'Dialog editor',
      kind: 'warning',
    })
    return
  }
  if (!dialogs[id]) {
    dispatch({ type: 'DIALOG_UPSERT', script: emptyDialogScript(id) })
  }
  dispatch({ type: 'DIALOG_SELECT', dialogId: id })
  dispatch({ type: 'DIALOG_OPEN_MODAL', dialogId: id })
}

/** Open full dialog library in modal (no preselected id). */
export function openDialogLibraryModal(dispatch: Dispatch<Action>): void {
  dispatch({ type: 'DIALOG_OPEN_MODAL', dialogId: '' })
}
