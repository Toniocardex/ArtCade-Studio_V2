// ---------------------------------------------------------------------------
// Project entity class picker (spawnEntity, compareClass, withClass, …)
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useEditor } from '../../store/editor-store'
import { allClassNames, classDisplayLabel } from '../../utils/project'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'

/** Sentinel for "Other…" in the select (not stored in logic JSON). */
export const CLASS_PICKER_OTHER = '__other__'

export function classPickerSelectValue(
  value: string,
  classNames: readonly string[],
): string {
  if (!value) return ''
  if (classNames.includes(value)) return value
  return CLASS_PICKER_OTHER
}

export function isClassPickerOtherMode(
  value: string,
  classNames: readonly string[],
): boolean {
  return value !== '' && !classNames.includes(value)
}

export function ClassNamePicker({
  value,
  onChange,
  classNames: classNamesProp,
  allowEmpty = true,
  emptyLabel = '— Choose object —',
}: {
  value: string
  onChange: (className: string) => void
  /** Override for tests; otherwise from open project. */
  classNames?: string[]
  /** Show blank first option (filters / optional class fields). */
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  const { state } = useEditor()
  const classNames = useMemo(
    () => classNamesProp ?? (state.project ? allClassNames(state.project) : []),
    [classNamesProp, state.project],
  )

  const selectValue = classPickerSelectValue(value, classNames)
  const otherMode = isClassPickerOtherMode(value, classNames)

  if (classNames.length === 0) {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--muted)] italic">
          No object types in this project yet. Add objects in the Scene first.
        </span>
        <input
          className={`${inp} w-36`}
          placeholder="Type name…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 flex-wrap">
      <select
        className={sel}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value
          if (v === CLASS_PICKER_OTHER) {
            if (!otherMode) onChange('')
            return
          }
          onChange(v)
        }}
      >
        {allowEmpty && (
          <option value="">{emptyLabel}</option>
        )}
        {classNames.map((c) => (
          <option key={c} value={c}>
            {classDisplayLabel(state.project, c)}
          </option>
        ))}
        <option value={CLASS_PICKER_OTHER}>Other…</option>
      </select>
      {(selectValue === CLASS_PICKER_OTHER || otherMode) && (
        <input
          className={`${inp} w-32`}
          placeholder="Custom name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </span>
  )
}
