import { useEffect } from 'react'
import { useEditor } from '../../store/editor-store'
import { emptyDialogScript } from '../../utils/dialog/dialog-script'
import { DialogScriptEditor } from './DialogScriptEditor'

export function DialogEditorModal() {
  const { state, dispatch } = useEditor()
  const { open, dialogId } = state.dialogModal
  if (!open || !dialogId) return null

  const script = state.dialogs[dialogId]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'DIALOG_CLOSE_MODAL' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dispatch({ type: 'DIALOG_CLOSE_MODAL' })
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-editor-title"
        className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <h2 id="dialog-editor-title" className="text-sm font-semibold flex-1">
            Edit dialog: {dialogId}
          </h2>
          <button
            type="button"
            className="text-xs text-[var(--accent)]"
            onClick={() => {
              dispatch({ type: 'DIALOG_CLOSE_MODAL' })
              dispatch({ type: 'DIALOG_SELECT', dialogId })
              dispatch({ type: 'SET_MODE', mode: 'dialog' })
            }}
          >
            Open in Dialog library
          </button>
          <button
            type="button"
            className="text-xs px-3 py-1 rounded border border-[var(--border)]"
            onClick={() => dispatch({ type: 'DIALOG_CLOSE_MODAL' })}
          >
            Close
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {script ? (
            <DialogScriptEditor script={script} compact />
          ) : (
            <p className="p-4 text-sm text-[var(--muted)]">Dialog not found.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function openDialogEditorForId(
  dispatch: ReturnType<typeof useEditor>['dispatch'],
  dialogs: Record<string, import('../../utils/dialog/dialog-script').DialogScript>,
  dialogId: string,
): void {
  const id = dialogId.trim()
  if (!id) {
    window.alert('Set a Dialog ID on this component first.')
    return
  }
  if (!dialogs[id]) {
    dispatch({ type: 'DIALOG_UPSERT', script: emptyDialogScript(id) })
  }
  dispatch({ type: 'DIALOG_OPEN_MODAL', dialogId: id })
}
