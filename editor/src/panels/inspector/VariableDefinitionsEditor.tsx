import { Plus } from 'lucide-react'
import type {
  GameVariableDefinition,
  GameVariableType,
  GameVariableValue,
} from '../../types'
import { handleControlledInputKeyDown } from '../../utils/keyboard'

const fieldClass = 'editor-input'

function defaultValue(type: GameVariableType): GameVariableValue {
  if (type === 'boolean') return false
  if (type === 'string') return ''
  return 0
}

/**
 * Variable keys compile to Lua identifiers, so they must match
 * /^[A-Za-z_][A-Za-z0-9_]*$/. Sanitize as the user types: spaces become
 * underscores and any other invalid character is dropped, preventing keys like
 * "text var" that fail project validation on every compile.
 */
function sanitizeVariableKey(raw: string): string {
  return raw
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
}

export function VariableDefinitionsEditor({
  variables,
  onChange,
}: Readonly<{
  variables: GameVariableDefinition[]
  onChange: (variables: GameVariableDefinition[]) => void
}>) {
  const patch = (index: number, next: GameVariableDefinition) => {
    onChange(variables.map((variable, itemIndex) => itemIndex === index ? next : variable))
  }

  return (
    <div className="space-y-2">
      {variables.map((variable, index) => (
        <div key={index} className="rounded border border-[var(--border)] p-2 space-y-1.5">
          <div className="grid grid-cols-[1fr_90px_auto] gap-1">
            <input
              className={fieldClass}
              aria-label="Variable key"
              placeholder="variable_key"
              value={variable.key}
              onChange={(event) => patch(index, { ...variable, key: sanitizeVariableKey(event.target.value) })}
              onKeyDown={(event) => handleControlledInputKeyDown(event, (key) => {
                patch(index, { ...variable, key: sanitizeVariableKey(key) })
              })}
            />
            <select
              className={fieldClass}
              aria-label="Variable type"
              value={variable.type}
              onChange={(event) => {
                const type = event.target.value as GameVariableType
                patch(index, { ...variable, type, initialValue: defaultValue(type) })
              }}
            >
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="string">String</option>
            </select>
            <button
              type="button"
              className="px-2 text-xs text-[var(--danger)]"
              onClick={() => onChange(variables.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </button>
          </div>
          {variable.type === 'boolean' ? (
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={variable.initialValue === true}
                onChange={(event) => patch(index, { ...variable, initialValue: event.target.checked })}
              />
              Initial value
            </label>
          ) : (
            <input
              className={fieldClass}
              type={variable.type === 'number' ? 'number' : 'text'}
              aria-label="Initial value"
              placeholder="Initial value"
              value={String(variable.initialValue)}
              onChange={(event) => patch(index, {
                ...variable,
                initialValue: variable.type === 'number'
                  ? Number(event.target.value) || 0
                  : event.target.value,
              })}
              onKeyDown={(event) => handleControlledInputKeyDown(event, (text) => {
                patch(index, {
                  ...variable,
                  initialValue: variable.type === 'number'
                    ? Number(text) || 0
                    : text,
                })
              })}
            />
          )}
          <input
            className={fieldClass}
            aria-label="Variable description"
            placeholder="Description (optional)"
            value={variable.description ?? ''}
            onChange={(event) => patch(index, { ...variable, description: event.target.value })}
            onKeyDown={(event) => handleControlledInputKeyDown(event, (description) => {
              patch(index, { ...variable, description })
            })}
          />
        </div>
      ))}
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]"
        onClick={() => onChange([
          ...variables,
          { key: `variable_${variables.length + 1}`, type: 'number', initialValue: 0 },
        ])}
      >
        <Plus size={13} />
        Declare variable
      </button>
    </div>
  )
}
