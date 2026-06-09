// ---------------------------------------------------------------------------
// Entity tag picker (sensor targetTag, filters, …)
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useEditorSelector } from '../../store/editor-store'
import { allEntityTags } from '../../utils/project'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'

export const TAG_PICKER_OTHER = '__other__'

export function tagPickerSelectValue(
  value: string,
  tags: readonly string[],
): string {
  if (!value) return ''
  if (tags.includes(value)) return value
  return TAG_PICKER_OTHER
}

export function isTagPickerOtherMode(
  value: string,
  tags: readonly string[],
): boolean {
  return value !== '' && !tags.includes(value)
}

export type TagPickerProps = Readonly<{
  value: string
  onChange: (tag: string) => void
  /** Override for tests; otherwise from open project. */
  tags?: string[]
  allowEmpty?: boolean
  emptyLabel?: string
}>

export function TagPicker({
  value,
  onChange,
  tags: tagsProp,
  allowEmpty = true,
  emptyLabel = '— Any tag —',
}: TagPickerProps) {
  const project = useEditorSelector((s) => s.project)
  const tags = useMemo(
    () => tagsProp ?? (project ? allEntityTags(project) : []),
    [tagsProp, project],
  )

  const selectValue = tagPickerSelectValue(value, tags)
  const otherMode = isTagPickerOtherMode(value, tags)

  if (tags.length === 0) {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--muted)] italic">
          No tags in project yet. Add tags on entities or Sensor.targetTag in Inspector.
        </span>
        <input
          className={`${inp} w-36`}
          placeholder="e.g. player"
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
          if (v === TAG_PICKER_OTHER) {
            if (!otherMode) onChange('')
            return
          }
          onChange(v)
        }}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value={TAG_PICKER_OTHER}>Other…</option>
      </select>
      {(selectValue === TAG_PICKER_OTHER || otherMode) && (
        <input
          className={`${inp} w-32`}
          placeholder="Custom tag"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </span>
  )
}
