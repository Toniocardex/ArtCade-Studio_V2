/**
 * Dialog library — sidebar list + RPG Maker-style command editor (modal shell).
 */
import { useEditor } from '../store/editor-store'
import { DialogLibrarySidebar } from './dialog/DialogLibrarySidebar'
import { DialogScriptEditor } from './dialog/DialogScriptEditor'
import { DialogMessagePreview } from './dialog/DialogMessagePreview'
import { EditorShellLayout } from '../components/shell/EditorShellLayout'

function DialogEditorHint() {
  return (
    <p className="text-[10px] text-[var(--muted)] mt-1.5 leading-snug border-t border-[var(--outline-subtle)] pt-2">
      Dialogs are stored in this library by ID. Add the{' '}
      <span className="text-[var(--purple)]">Dialog</span> component on an NPC, or use{' '}
      <span className="text-[var(--accent)]">Start dialog</span> on the Logic Board.
    </p>
  )
}

export default function DialogEditorPanel() {
  const { state } = useEditor()
  const id = state.selectedDialogId
  const script = id ? state.dialogs[id] : null

  const center = (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full">
      <header className="shrink-0 px-4 py-2 border-b border-[var(--outline)] bg-[var(--surface)]">
        <h1 className="text-sm font-semibold text-[var(--primary)]">
          {id ? `Dialog: ${id}` : 'Select or create a dialog'}
        </h1>
        <p className="text-[10px] text-[var(--muted)] mt-0.5">
          Saved to <code className="text-[var(--primary-soft)]">dialogs/{id ?? '…'}.json</code> on Save Project
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
  )

  return (
    <EditorShellLayout
      className="h-full"
      left={<DialogLibrarySidebar wide />}
      center={center}
      right={
        script ? (
          <div className="h-full flex flex-col p-3 border-l border-[var(--outline)] bg-[var(--surface)]">
            <p className="text-[9px] uppercase tracking-wide text-[var(--muted)] mb-2">Preview</p>
            <DialogMessagePreview commands={script.commands} focusIndex={null} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-4 text-[10px] text-[var(--muted)]">
            Preview
          </div>
        )
      }
    />
  )
}
