import type { DialogCommand } from '../../utils/dialog/dialog-script'
import { DialogCommandCard } from './DialogCommandCard'

type DialogChoiceBranchEditorProps = Readonly<{
  commands: DialogCommand[]
  onChange: (commands: DialogCommand[]) => void
  depth?: number
}>

export function DialogChoiceBranchEditor({
  commands,
  onChange,
  depth = 0,
}: DialogChoiceBranchEditorProps) {
  const pad = depth > 0 ? 'ml-4 border-l-2 border-[var(--border)] pl-3' : ''

  function updateAt(i: number, cmd: DialogCommand) {
    const next = [...commands]
    next[i] = cmd
    onChange(next)
  }

  function removeAt(i: number) {
    onChange(commands.filter((_, j) => j !== i))
  }

  function moveAt(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= commands.length) return
    const a = commands[i]
    const b = commands[j]
    if (a === undefined || b === undefined) return
    const next = [...commands]
    next[i] = b
    next[j] = a
    onChange(next)
  }

  function addCommand(type: DialogCommand['type']) {
    const stub = defaultCommand(type)
    onChange([...commands, stub])
  }

  return (
    <div className={pad}>
      {commands.map((cmd, i) => (
        <DialogCommandCard
          key={`${depth}-${i}-${cmd.type}`}
          command={cmd}
          index={i}
          total={commands.length}
          nested
          onChange={(c) => updateAt(i, c)}
          onDelete={() => removeAt(i)}
          onMoveUp={() => moveAt(i, -1)}
          onMoveDown={() => moveAt(i, 1)}
        />
      ))}
      <div className="flex flex-wrap gap-1 mt-1 mb-2">
        <AddCmdButton label="+ Text" onClick={() => addCommand('showText')} />
        <AddCmdButton label="+ Set var" onClick={() => addCommand('setVariable')} />
        <AddCmdButton label="+ Message" onClick={() => addCommand('emitMessage')} />
        <AddCmdButton label="+ End" onClick={() => addCommand('end')} />
      </div>
    </div>
  )
}

function AddCmdButton({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--panel)]"
    >
      {label}
    </button>
  )
}

export function defaultCommand(type: DialogCommand['type']): DialogCommand {
  switch (type) {
    case 'showText':
      return { type: 'showText', character: '', text: '' }
    case 'showChoices':
      return {
        type: 'showChoices',
        options: [
          { text: 'Option A', commands: [{ type: 'end' }] },
          { text: 'Option B', commands: [{ type: 'end' }] },
        ],
      }
    case 'setVariable':
      return { type: 'setVariable', variable: '', operation: '=', value: 0 }
    case 'emitMessage':
      return { type: 'emitMessage', event: '' }
    case 'condition':
      return {
        type: 'condition',
        variable: '',
        operator: '==',
        value: 0,
        ifTrue: [{ type: 'end' }],
        ifFalse: [{ type: 'end' }],
      }
    case 'end':
      return { type: 'end' }
    default:
      return { type: 'end' }
  }
}
