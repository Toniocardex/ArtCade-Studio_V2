import { useMemo } from 'react'
import { useEditor } from '../../store/editor-store'
import {
  formatClipOption,
  listProjectClips,
} from '../../utils/animation-clips-catalog'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs max-w-[14rem]'

export type ClipPickerProps = Readonly<{
  value: string
  onChange: (clipName: string) => void
  allowEmpty?: boolean
  emptyLabel?: string
  /** When set (entity rulesheet), list only clips on this sprite sheet. */
  filterSpritePath?: string
  /** Target instances disagree on sprite sheet — show all clips + warning. */
  ambiguousTargetSpritePaths?: boolean
}>

export function ClipPicker({
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = '— Choose clip —',
  filterSpritePath,
  ambiguousTargetSpritePaths = false,
}: ClipPickerProps) {
  const { state } = useEditor()
  const project = state.project
  const entries = useMemo(
    () => listProjectClips(project, filterSpritePath),
    [project, filterSpritePath],
  )

  const trimmed = value.trim()
  const duplicateWarn =
    trimmed.length > 0 && entries.filter((e) => e.clipName === trimmed).length > 1

  if (entries.length === 0) {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--muted)] italic">
          {filterSpritePath
            ? 'No clips on this entity\'s sprite sheet. Add clips in Sprite Studio on that image.'
            : 'No animation clips in this project. Add clips in Sprite Studio on an image sheet.'}
        </span>
        <input
          className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs w-36"
          placeholder="Clip name…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    )
  }

  const inList = entries.some((e) => e.clipName === value)

  return (
    <span className="flex flex-col gap-1">
      <select
        className={sel}
        value={inList || !value ? value : '__custom__'}
        title={value}
        onChange={(e) => {
          const v = e.target.value
          if (v === '__custom__') {
            if (!value) onChange('')
            return
          }
          onChange(v)
        }}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {entries.map((e) => (
          <option
            key={`${e.assetId}:${e.clipName}`}
            value={e.clipName}
            title={`${e.clipName} (${e.spritePath})`}
          >
            {formatClipOption(e.clipName, { id: e.assetId, name: e.assetLabel, path: e.spritePath }, e.assetId)}
          </option>
        ))}
        {!inList && value ? (
          <option value="__custom__">Custom: {value}</option>
        ) : null}
      </select>
      {(!inList && value) || duplicateWarn ? (
        <input
          className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs w-36"
          placeholder="Clip name…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {duplicateWarn ? (
        <span className="text-[9px] text-[var(--warn)] leading-snug">
          Clip name &quot;{value}&quot; exists on multiple sheets — runtime uses one global name.
        </span>
      ) : null}
      {ambiguousTargetSpritePaths ? (
        <span className="text-[9px] text-[var(--warn)] leading-snug">
          This rulesheet&apos;s instances use different sprite sheets — showing clips from the whole project.
        </span>
      ) : null}
    </span>
  )
}
