import type { TargetSelector } from '../../types/logic-board'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'

export function TargetPicker({
  value,
  onChange,
}: {
  value: TargetSelector
  onChange: (t: TargetSelector) => void
}) {
  const kind =
    value === 'self' || value === 'other'
      ? value
      : typeof value === 'object' && 'entityId' in value
        ? 'entityId'
        : 'className'
  return (
    <span className="flex items-center gap-1">
      <select
        className={sel}
        value={kind}
        onChange={(e) => {
          const k = e.target.value
          if (k === 'self' || k === 'other') onChange(k)
          else if (k === 'entityId') onChange({ entityId: 1 })
          else onChange({ className: '', first: true })
        }}
      >
        <option value="self">self</option>
        <option value="other">other</option>
        <option value="entityId">entity #</option>
        <option value="className">class</option>
      </select>
      {kind === 'entityId' && typeof value === 'object' && 'entityId' in value && (
        <input
          type="number"
          className={`${inp} w-16`}
          value={value.entityId}
          onChange={(e) => onChange({ entityId: parseFloat(e.target.value) || 0 })}
        />
      )}
      {kind === 'className' && typeof value === 'object' && 'className' in value && (
        <input
          className={`${inp} w-28`}
          placeholder="ClassName"
          value={value.className}
          onChange={(e) => onChange({ className: e.target.value, first: true })}
        />
      )}
    </span>
  )
}
