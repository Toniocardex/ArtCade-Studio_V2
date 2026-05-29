import type { Vec2 } from '../../types'
import {
  activePresetId,
  clampPivot,
  formatPivotLabel,
  PIVOT_PRESETS,
} from '../../utils/sprite-pivot'
import { NumberField } from '../../panels/inspector/inspector-fields'

export type PivotPresetFieldsProps = Readonly<{
  pivot: Vec2
  onChange: (pivot: Vec2) => void
  compact?: boolean
}>

export function PivotPresetFields({ pivot, onChange, compact = false }: PivotPresetFieldsProps) {
  const commit = (next: Vec2) => onChange(clampPivot(next))

  return (
    <div className={compact ? 'space-y-2' : 'mb-2'}>
      <p className="text-[9px] text-[var(--muted)] uppercase mb-1">
        Pivot — {formatPivotLabel(pivot)}
      </p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <NumberField
          label="Pivot X"
          value={pivot.x}
          onCommit={(v) => commit({ ...pivot, x: v })}
        />
        <NumberField
          label="Pivot Y"
          value={pivot.y}
          onCommit={(v) => commit({ ...pivot, y: v })}
        />
      </div>
      <div
        className="grid grid-cols-3 gap-1 mb-1"
        role="group"
        aria-label="Pivot presets"
      >
        {PIVOT_PRESETS.map((preset) => {
          const active = activePresetId(pivot) === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={active}
              onClick={() => commit({ ...preset.pivot })}
              className={`h-6 rounded text-[9px] font-semibold border transition-colors
                ${active
                  ? 'border-[var(--accent-2)] bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent-bd)]'
                }`}
            >
              {preset.id.toUpperCase()}
            </button>
          )
        })}
      </div>
      <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.7)] leading-snug">
        Transform position is the pivot point on the sprite.
      </p>
    </div>
  )
}
