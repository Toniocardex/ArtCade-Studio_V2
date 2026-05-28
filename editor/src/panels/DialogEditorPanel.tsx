/**
 * Dialog library — sidebar list + RPG Maker-style command editor.
 */
import { useEditor } from '../store/editor-store'
import { DialogLibrarySidebar } from './dialog/DialogLibrarySidebar'
import { DialogScriptEditor } from './dialog/DialogScriptEditor'

function DialogEditorHint() {
  return (
    <p className="text-[10px] text-[var(--muted)] mt-1.5 leading-snug border-t border-[var(--border)] pt-2">
      Dialogs are stored in this library by ID. To use them in-game: add the{' '}
      <span className="text-[var(--purple)]">Dialog</span> component on an NPC with the same
      Dialog ID, or trigger <span className="text-[var(--accent)]">Start dialog</span> on the
      Logic Board (PLAY uses the ID string, not the component).
    </p>
  )
}

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
          <DialogEditorHint />
        </header>
        {script ? (
          <DialogScriptEditor script={script} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-[var(--muted)] p-8 text-center max-w-md">
            <p>Choose a dialog from the sidebar or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export { emptyDialogScript } from '../utils/dialog/dialog-script'
