import { useEffect, useRef } from 'react'
import { useEditor } from '../../store/editor-store'
import DialogEditorPanel from '../DialogEditorPanel'

export function DialogEditorModal() {
  const { state, dispatch } = useEditor()
  const { open } = state.dialogModal
  const dialogRef = useRef<HTMLDialogElement>(null)
  const visible = open

  useEffect(() => {
    if (!visible) return
    const el = dialogRef.current
    if (!el) return
    if (!el.open) el.showModal()
    return () => {
      if (el.open) el.close()
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
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
  }, [visible, dispatch])

  const closeModal = () => {
    dialogRef.current?.close()
    dispatch({ type: 'DIALOG_CLOSE_MODAL' })
  }

  if (!visible) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dialog-editor-title"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[200] m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-0 bg-transparent p-4 backdrop:bg-black/70"
    >
      <div
        className="flex flex-col w-[min(96vw,1400px)] h-[min(88vh,900px)] max-h-[92vh] rounded-[var(--radius-md)] border border-[var(--outline)] bg-[var(--surface)] text-[var(--primary)] overflow-hidden"
      >
        <header className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--outline)] bg-[var(--surface)]">
          <h2 id="dialog-editor-title" className="text-sm font-semibold flex-1">
            Dialog library
          </h2>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-[var(--outline)] hover:bg-[var(--outline)] transition-colors duration-100"
            onClick={closeModal}
          >
            Close
          </button>
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--void)]">
          <DialogEditorPanel />
        </div>
      </div>
    </dialog>
  )
}

export { openDialogEditorForId, openDialogLibraryModal } from './dialog-modal-api'
