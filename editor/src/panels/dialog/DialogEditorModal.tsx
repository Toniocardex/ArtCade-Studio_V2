import { useEffect, useRef } from 'react'
import { useEditor } from '../../store/editor-store'
import { emptyDialogScript } from '../../utils/dialog/dialog-script'
import { DialogScriptEditor } from './DialogScriptEditor'

export function DialogEditorModal() {
  const { state, dispatch } = useEditor()
  const { open, dialogId } = state.dialogModal
  const dialogRef = useRef<HTMLDialogElement>(null)
  const script = dialogId ? state.dialogs[dialogId] : undefined

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && dialogId) {
      if (!el.open) el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [open, dialogId])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      dispatch({ type: 'DIALOG_CLOSE_MODAL' })
    }
    const onClose = () => dispatch({ type: 'DIALOG_CLOSE_MODAL' })
    el.addEventListener('cancel', onCancel)
    el.addEventListener('close', onClose)
    return () => {
      el.removeEventListener('cancel', onCancel)
      el.removeEventListener('close', onClose)
    }
  }, [dispatch])

  const closeModal = () => {
    dialogRef.current?.close()
    dispatch({ type: 'DIALOG_CLOSE_MODAL' })
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={open && dialogId ? 'dialog-editor-title' : undefined}
      aria-modal={open && dialogId ? true : undefined}
      className="fixed inset-0 z-[200] m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-0 bg-transparent p-6 backdrop:bg-black/60 open:flex"
    >
      {open && dialogId ? (
      <div
        className="flex flex-col w-full max-w-3xl min-h-[min(40vh,20rem)] h-[min(85vh,42rem)] max-h-[90vh] rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl overflow-hidden"
      >
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <h2 id="dialog-editor-title" className="text-sm font-semibold flex-1">
            Edit dialog: {dialogId}
          </h2>
          <button
            type="button"
            className="text-xs text-[var(--accent)]"
            onClick={() => {
              closeModal()
              dispatch({ type: 'DIALOG_SELECT', dialogId })
              dispatch({ type: 'SET_MODE', mode: 'dialog' })
            }}
          >
            Open in Dialog library
          </button>
          <button
            type="button"
            className="text-xs px-3 py-1 rounded border border-[var(--border)]"
            onClick={closeModal}
          >
            Close
          </button>
        </header>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {script ? (
            <DialogScriptEditor script={script} compact />
          ) : (
            <p className="p-4 text-sm text-[var(--muted)]">Dialog not found.</p>
          )}
        </div>
      </div>
      ) : null}
    </dialog>
  )
}

export function openDialogEditorForId(
  dispatch: ReturnType<typeof useEditor>['dispatch'],
  dialogs: Record<string, import('../../utils/dialog/dialog-script').DialogScript>,
  dialogId: string,
): void {
  const id = dialogId.trim()
  if (!id) {
    globalThis.alert('Set a Dialog ID on this component first.')
    return
  }
  if (!dialogs[id]) {
    dispatch({ type: 'DIALOG_UPSERT', script: emptyDialogScript(id) })
  }
  dispatch({ type: 'DIALOG_OPEN_MODAL', dialogId: id })
}
