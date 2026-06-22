import { useMemo } from 'react'
import { useEditorSelector } from '../../store/editor-store'
import {
  formatClipOption,
  listProjectClips,
  type ProjectClipEntry,
} from '../../utils/animation-clips-catalog'
import { EditorSelect, type EditorSelectGroup } from '../ui/EditorSelect'

export type ClipPickerProps = Readonly<{
  value: string
  onChange: (clipName: string) => void
  allowEmpty?: boolean
  emptyLabel?: string
  /** When set (entity rulesheet), the object's own sheet clips are listed first. */
  filterSpritePath?: string
  /** Target instances disagree on sprite sheet — show all clips + warning. */
  ambiguousTargetSpritePaths?: boolean
}>

function clipKey(e: ProjectClipEntry): string {
  return `${e.clipName}::${e.spritePath}::${e.assetId}`
}

function toOption(e: ProjectClipEntry) {
  return {
    value: e.clipName,
    label: formatClipOption(
      e.clipName,
      { id: e.assetId, name: e.assetLabel, path: e.spritePath, usage: 'sprite' },
      e.assetId,
    ),
    title: `${e.clipName} (${e.spritePath})`,
  }
}

export function ClipPicker({
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = '— Choose clip —',
  filterSpritePath,
  ambiguousTargetSpritePaths = false,
}: ClipPickerProps) {
  const project = useEditorSelector((s) => s.project)

  // Show every clip in the project so an object can play animations that live
  // on any sheet (the picker previously hid clips not on the object's own sheet).
  // The object's own sheet is grouped first for quick access.
  const { entries, ownEntries, otherEntries } = useMemo(() => {
    const all = listProjectClips(project)
    const own = filterSpritePath ? listProjectClips(project, filterSpritePath) : []
    const ownKeys = new Set(own.map(clipKey))
    const others = own.length > 0 ? all.filter((e) => !ownKeys.has(clipKey(e))) : all
    return { entries: all, ownEntries: own, otherEntries: others }
  }, [project, filterSpritePath])

  const trimmed = value.trim()
  const duplicateWarn =
    trimmed.length > 0 && entries.filter((e) => e.clipName === trimmed).length > 1

  if (entries.length === 0) {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--muted)] italic">
          No animation clips in this project. Add clips in Sprite Studio on an image sheet.
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

  const emptyOption = allowEmpty ? [{ value: '', label: emptyLabel }] : []
  const customOption =
    !inList && value ? [{ value: '__custom__', label: `Custom: ${value}` }] : []

  // Two groups (own sheet + other sheets) only when both are non-empty and we
  // have a sheet context; otherwise a single flat list.
  const groups: EditorSelectGroup[] =
    ownEntries.length > 0 && otherEntries.length > 0
      ? [
          { label: 'This object’s sheet', options: [...emptyOption, ...ownEntries.map(toOption)] },
          { label: 'Other sheets', options: [...otherEntries.map(toOption), ...customOption] },
        ]
      : [{ options: [...emptyOption, ...entries.map(toOption), ...customOption] }]

  return (
    <span className="flex flex-col gap-1">
      <EditorSelect
        className="w-auto max-w-[14rem]"
        triggerClassName="py-1"
        value={inList || !value ? value : '__custom__'}
        title={value}
        onChange={(v) => {
          if (v === '__custom__') {
            if (!value) onChange('')
            return
          }
          onChange(v)
        }}
        groups={groups}
        aria-label="Animation clip"
      />
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
