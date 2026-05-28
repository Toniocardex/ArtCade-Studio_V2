import type { TargetSelector } from '../../types/logic-board'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'

export type TargetPickerKind = 'self' | 'other' | 'entityId' | 'className'

export function targetPickerKind(value: TargetSelector): TargetPickerKind {
  if (value === 'self' || value === 'other') return value
  if (typeof value === 'object' && 'entityId' in value) return 'entityId'
  return 'className'
}

export type TargetPickerProps = Readonly<{
  value: TargetSelector
  onChange: (t: TargetSelector) => void
}>

export function TargetPicker({ value, onChange }: TargetPickerProps) {
  const kind = targetPickerKind(value)
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
        <option value="self">This object</option>
        <option value="other">Other object</option>
        <option value="entityId">Object #</option>
        <option value="className">Objects of class</option>
      </select>
      {kind === 'entityId' && typeof value === 'object' && 'entityId' in value && (
        <input
          type="number"
          className={`${inp} w-16`}
          value={value.entityId}
          onChange={(e) =>
            onChange({ entityId: Number.parseFloat(e.target.value) || 0 })
          }
        />
      )}
      {kind === 'className' && typeof value === 'object' && 'className' in value && (
        <input
          className={`${inp} w-28`}
          placeholder="Class name"
          value={value.className}
          onChange={(e) => onChange({ className: e.target.value, first: true })}
        />
      )}
    </span>
  )
}
