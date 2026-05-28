import type { ReactNode } from 'react'
import type { DialogCommand } from '../../utils/dialog/dialog-script'
import { DialogChoiceBranchEditor, defaultCommand } from './DialogChoiceBranchEditor'

const inputCls =
  'w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)]'

const COMMAND_LABELS: Record<DialogCommand['type'], string> = {
  showText: 'Show Text',
  showChoices: 'Show Choices',
  setVariable: 'Set Variable',
  emitMessage: 'Emit Message',
  condition: 'Conditional Branch',
  end: 'End Conversation',
}

const COMMAND_TYPES = Object.keys(COMMAND_LABELS) as DialogCommand['type'][]

function isDialogCommandType(value: string): value is DialogCommand['type'] {
  return (COMMAND_TYPES as readonly string[]).includes(value)
}

function choiceOptionKey(opt: { text: string; commands: DialogCommand[] }): string {
  const branchSig = opt.commands.map((c) => c.type).join('|')
  return `${opt.text}::${branchSig}`
}

export type DialogCommandCardProps = Readonly<{
  command: DialogCommand
  index: number
  total: number
  nested?: boolean
  focused?: boolean
  onFocus?: () => void
  onMouseEnter?: () => void
  onChange: (cmd: DialogCommand) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}>

export function DialogCommandCard({
  command,
  index,
  total,
  nested = false,
  focused = false,
  onFocus,
  onMouseEnter,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: DialogCommandCardProps) {
  const focusRow = () => {
    onFocus?.()
    onMouseEnter?.()
  }
  const rowFocus = nested ? undefined : focusRow

  return (
    <section
      className={`rounded-lg border mb-2 p-3 ${
        focused
          ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
          : 'border-[var(--border)] bg-[rgb(var(--border-rgb)/0.12)]'
      }`}
      aria-label={`${COMMAND_LABELS[command.type]} step ${index + 1} of ${total}`}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--purple)]">
          {COMMAND_LABELS[command.type]}
        </span>
        {!nested && (
          <select
            className="text-[10px] ml-auto bg-[var(--panel)] border border-[var(--border)] rounded px-1 py-0.5 text-[var(--text)]"
            value={command.type}
            onFocus={rowFocus}
            onMouseEnter={onMouseEnter}
            onChange={(e) => {
              const nextType = e.target.value
              if (isDialogCommandType(nextType)) onChange(defaultCommand(nextType))
            }}
          >
            {COMMAND_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMMAND_LABELS[t]}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1 ml-auto">
          <IconBtn title="Move up" disabled={index === 0} onClick={onMoveUp}>
            ↑
          </IconBtn>
          <IconBtn title="Move down" disabled={index >= total - 1} onClick={onMoveDown}>
            ↓
          </IconBtn>
          <IconBtn title="Delete" onClick={onDelete}>
            ×
          </IconBtn>
        </div>
      </div>

      {command.type === 'showText' && (
        <>
          <Field label="Character">
            <input
              className={inputCls}
              value={command.character}
              onFocus={rowFocus}
              onChange={(e) => onChange({ ...command, character: e.target.value })}
            />
          </Field>
          <Field label="Message">
            <textarea
              className={`${inputCls} min-h-[72px]`}
              rows={4}
              value={command.text}
              onFocus={rowFocus}
              onMouseEnter={onMouseEnter}
              onChange={(e) => onChange({ ...command, text: e.target.value })}
            />
          </Field>
          <Field label="Portrait (optional)">
            <input
              className={inputCls}
              value={command.portrait ?? ''}
              onChange={(e) =>
                onChange({
                  ...command,
                  portrait: e.target.value || undefined,
                })
              }
            />
          </Field>
        </>
      )}

      {command.type === 'showChoices' && (
        <div className="space-y-3">
          {command.options.map((opt, oi) => (
            <div key={choiceOptionKey(opt)} className="rounded border border-[var(--border)] p-2">
              <Field label={`Choice ${oi + 1}`}>
                <input
                  className={inputCls}
                  value={opt.text}
                  onFocus={rowFocus}
                  onMouseEnter={onMouseEnter}
                  onChange={(e) => {
                    const options = [...command.options]
                    options[oi] = { ...opt, text: e.target.value }
                    onChange({ ...command, options })
                  }}
                />
              </Field>
              <p className="text-[9px] text-[var(--muted)] mb-1">When selected:</p>
              <DialogChoiceBranchEditor
                commands={opt.commands}
                depth={1}
                onChange={(cmds) => {
                  const options = [...command.options]
                  options[oi] = { ...opt, commands: cmds }
                  onChange({ ...command, options })
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-[10px] text-[var(--accent)]"
            onClick={() =>
              onChange({
                ...command,
                options: [
                  ...command.options,
                  { text: `Option ${command.options.length + 1}`, commands: [{ type: 'end' }] },
                ],
              })
            }
          >
            + Add choice
          </button>
          {command.options.length > 2 && (
            <button
              type="button"
              className="text-[10px] text-[var(--muted)] ml-2"
              onClick={() =>
                onChange({
                  ...command,
                  options: command.options.slice(0, -1),
                })
              }
            >
              Remove last
            </button>
          )}
        </div>
      )}

      {command.type === 'setVariable' && (
        <>
          <Field label="Variable">
            <input
              className={inputCls}
              value={command.variable}
              onChange={(e) => onChange({ ...command, variable: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Field label="Op">
              <select
                className={inputCls}
                value={command.operation}
                onChange={(e) =>
                  onChange({
                    ...command,
                    operation: e.target.value as '=' | '+=' | '-=',
                  })
                }
              >
                <option value="=">=</option>
                <option value="+=">+=</option>
                <option value="-=">-=</option>
              </select>
            </Field>
            <Field label="Value">
              <input
                type="number"
                className={inputCls}
                value={command.value}
                onChange={(e) => onChange({ ...command, value: Number(e.target.value) })}
              />
            </Field>
          </div>
        </>
      )}

      {command.type === 'emitMessage' && (
        <Field label="Message name">
          <input
            className={inputCls}
            value={command.event}
            onChange={(e) => onChange({ ...command, event: e.target.value })}
          />
        </Field>
      )}

      {command.type === 'condition' && (
        <>
          <Field label="Variable">
            <input
              className={inputCls}
              value={command.variable}
              onChange={(e) => onChange({ ...command, variable: e.target.value })}
            />
          </Field>
          <div className="flex gap-2 mb-2">
            <Field label="Operator">
              <select
                className={inputCls}
                value={command.operator}
                onChange={(e) => onChange({ ...command, operator: e.target.value })}
              >
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value=">=">{'>='}</option>
                <option value="<=">{'<='}</option>
              </select>
            </Field>
            <Field label="Value">
              <input
                type="number"
                className={inputCls}
                value={command.value}
                onChange={(e) => onChange({ ...command, value: Number(e.target.value) })}
              />
            </Field>
          </div>
          <p className="text-[9px] text-[var(--muted)] mb-1">If true:</p>
          <DialogChoiceBranchEditor
            commands={command.ifTrue}
            depth={1}
            onChange={(ifTrue) => onChange({ ...command, ifTrue })}
          />
          <p className="text-[9px] text-[var(--muted)] mb-1 mt-2">If false:</p>
          <DialogChoiceBranchEditor
            commands={command.ifFalse}
            depth={1}
            onChange={(ifFalse) => onChange({ ...command, ifFalse })}
          />
        </>
      )}

      {command.type === 'end' && (
        <p className="text-xs text-[var(--muted)]">Closes the dialog and resumes gameplay.</p>
      )}
    </section>
  )
}

type FieldProps = Readonly<{
  label: string
  children: ReactNode
}>

function Field({ label, children }: FieldProps) {
  return (
    <div className="mb-2">
      <span className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">{label}</span>
      {children}
    </div>
  )
}

type IconBtnProps = Readonly<{
  children: ReactNode
  title: string
  disabled?: boolean
  onClick: () => void
}>

function IconBtn({
  children,
  title,
  disabled,
  onClick,
}: IconBtnProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="text-[10px] w-6 h-6 rounded border border-[var(--border)] text-[var(--text)] disabled:opacity-30 hover:bg-[var(--panel)]"
    >
      {children}
    </button>
  )
}
