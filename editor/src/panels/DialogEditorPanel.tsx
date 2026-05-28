/**
 * Dialog library — sidebar list + RPG Maker-style command editor.
 */
import { useEditor } from '../store/editor-store'
import { DialogLibrarySidebar } from './dialog/DialogLibrarySidebar'
import { DialogScriptEditor } from './dialog/DialogScriptEditor'
import { emptyDialogScript } from '../utils/dialog/dialog-script'

export default function DialogEditorPanel() {
  const { state } = useEditor()
  const id = state.selectedDialogId
  const script = id ? state.dialogs[id] : null

  return (
    <div className="flex flex-1 min-h-0 bg-[var(--bg)] text-[var(--text)]">
      <DialogLibrarySidebar />
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <header className="shrink-0 px-4 py-2 border-b border-[var(--border)]">
          <h1 className="text-sm font-semibold">
            {id ? `Dialog: ${id}` : 'Select or create a dialog'}
          </h1>
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            Saved to <code className="text-[var(--text)]">dialogs/{id ?? '…'}.json</code> on File →
            Save Project
          </p>
        </header>
        {script ? (
          <DialogScriptEditor script={script} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--muted)] p-8 text-center">
            Choose a dialog from the sidebar or create a new one.
          </div>
        )}
      </div>
    </div>
  )
}

export { emptyDialogScript }
