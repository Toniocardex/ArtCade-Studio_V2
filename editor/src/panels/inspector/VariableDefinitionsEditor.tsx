import type {
  GameVariableDefinition,
  GameVariableType,
  GameVariableValue,
} from '../../types'

const fieldClass = 'w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1 text-xs'

function defaultValue(type: GameVariableType): GameVariableValue {
  if (type === 'boolean') return false
  if (type === 'string') return ''
  return 0
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
              onChange={(event) => patch(index, { ...variable, key: event.target.value })}
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
            />
          )}
          <input
            className={fieldClass}
            aria-label="Variable description"
            placeholder="Description (optional)"
            value={variable.description ?? ''}
            onChange={(event) => patch(index, { ...variable, description: event.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-[var(--accent)]"
        onClick={() => onChange([
          ...variables,
          { key: `variable_${variables.length + 1}`, type: 'number', initialValue: 0 },
        ])}
      >
        + Declare variable
      </button>
    </div>
  )
}
