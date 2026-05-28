import { useState } from 'react'
import { useEditor } from '../../store/editor-store'
import type { DialogScript, DialogCommand } from '../../utils/dialog/dialog-script'
import { compileDialogScript } from '../../utils/dialog/dialog-script'
import { dialogGraphToJson } from '../../utils/dialog/import-dialog-csv'
import { DialogCommandCard } from './DialogCommandCard'
import { DialogMessagePreview } from './DialogMessagePreview'
import { defaultCommand } from './DialogChoiceBranchEditor'

export type DialogScriptEditorProps = Readonly<{
  script: DialogScript
  parseWarning?: string
  compact?: boolean
}>

export function DialogScriptEditor({
  script,
  parseWarning,
  compact = false,
}: DialogScriptEditorProps) {
  const { dispatch } = useEditor()
  const [focusIndex, setFocusIndex] = useState<number | null>(0)

  function upsert(next: DialogScript) {
    dispatch({ type: 'DIALOG_UPSERT', script: next })
  }

  function updateCommand(i: number, cmd: DialogCommand) {
    const commands = [...script.commands]
    commands[i] = cmd
    upsert({ ...script, commands })
  }

  function removeCommand(i: number) {
    upsert({ ...script, commands: script.commands.filter((_, j) => j !== i) })
  }

  function moveCommand(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= script.commands.length) return
    const commands = [...script.commands]
    const current = commands[i]
    const other = commands[j]
    if (current === undefined || other === undefined) return
    commands[i] = other
    commands[j] = current
    upsert({ ...script, commands })
  }

  function addCommand(type: DialogCommand['type']) {
    upsert({ ...script, commands: [...script.commands, defaultCommand(type)] })
    setFocusIndex(script.commands.length)
  }

  if (parseWarning) {
    return (
      <div className={`flex flex-col gap-2 min-h-0 ${compact ? 'h-full p-4' : 'flex-1 p-4'}`}>
        <p className="text-sm text-[var(--warn)] shrink-0">{parseWarning}</p>
        <textarea
          className="flex-1 min-h-0 font-mono text-xs p-2 rounded border border-[var(--border)] bg-[var(--panel)]"
          readOnly
          value={dialogGraphToJson(compileDialogScript(script))}
        />
      </div>
    )
  }

  const rootClass = compact
    ? 'flex flex-col h-full min-h-0'
    : 'flex flex-col flex-1 min-h-0 p-4'

  return (
    <div className={rootClass}>
      {!compact && (
        <DialogMessagePreview commands={script.commands} focusIndex={focusIndex} />
      )}

      <div
        className={
          compact
            ? 'shrink-0 flex flex-wrap gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel)]'
            : 'shrink-0 flex flex-wrap gap-2 my-3'
        }
      >
        <AddBtn onClick={() => addCommand('showText')}>+ Show Text</AddBtn>
        <AddBtn onClick={() => addCommand('showChoices')}>+ Show Choices</AddBtn>
        <AddBtn onClick={() => addCommand('setVariable')}>+ Set Variable</AddBtn>
        <AddBtn onClick={() => addCommand('emitMessage')}>+ Emit Message</AddBtn>
        <AddBtn onClick={() => addCommand('condition')}>+ Condition</AddBtn>
        <AddBtn onClick={() => addCommand('end')}>+ End</AddBtn>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {script.commands.map((cmd, i) => (
          <DialogCommandCard
            key={`${i}-${cmd.type}`}
            command={cmd}
            index={i}
            total={script.commands.length}
            focused={focusIndex === i}
            onFocus={() => setFocusIndex(i)}
            onMouseEnter={() => setFocusIndex(i)}
            onChange={(c) => updateCommand(i, c)}
            onDelete={() => removeCommand(i)}
            onMoveUp={() => moveCommand(i, -1)}
            onMoveDown={() => moveCommand(i, 1)}
          />
        ))}
      </div>
    </div>
  )
}

type AddBtnProps = Readonly<{
  children: React.ReactNode
  onClick: () => void
}>

function AddBtn({ children, onClick }: AddBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2 py-1 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
    >
      {children}
    </button>
  )
}
