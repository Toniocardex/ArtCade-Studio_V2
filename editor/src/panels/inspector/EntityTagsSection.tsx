import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useEditorDispatch } from '../../store/editor-store'
import type { EntityDef } from '../../types'

export type EntityTagsSectionProps = Readonly<{
  entity: EntityDef
}>

export function EntityTagsSection({ entity }: EntityTagsSectionProps) {
  const dispatch = useEditorDispatch()
  const [draft, setDraft] = useState('')
  const tagInputId = `entity-tag-input-${entity.id}`

  useEffect(() => setDraft(''), [entity.id])

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    dispatch({ type: 'ENTITY_ADD_TAG', entityId: entity.id, tag })
    setDraft('')
  }

  return (
    <div className="mb-2">
      <label
        htmlFor={tagInputId}
        className="text-[9px] text-[var(--muted)] uppercase block mb-1"
      >
        Tags
      </label>
      <p className="text-[9px] text-[var(--muted)] leading-snug mb-1.5">
        Used by sensors, filters, and lifecycle hooks. Logic Board rules use entity id, not tags.
      </p>
      {entity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {entity.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 bg-[var(--border)] border border-[var(--border-2)]
                         text-[var(--muted)] text-[9px] px-2 py-0.5 rounded"
            >
              #{t}
              <button
                type="button"
                title={`Remove tag ${t}`}
                aria-label={`Remove tag ${t}`}
                onClick={() =>
                  dispatch({ type: 'ENTITY_REMOVE_TAG', entityId: entity.id, tag: t })
                }
                className="text-[var(--muted)] hover:text-[var(--danger)] leading-none"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          id={tagInputId}
          type="text"
          value={draft}
          placeholder="e.g. player"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(draft)
            }
          }}
          className="flex-1 min-w-0 bg-[var(--panel-3)] border border-[var(--border-2)] rounded px-2 py-1
                     text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)] transition-colors"
        />
        <button
          type="button"
          onClick={() => addTag(draft)}
          disabled={!draft.trim()}
          className="px-2 py-1 rounded text-[10px] font-semibold border border-[var(--accent-bd)]
                     bg-[var(--accent-bg)] text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  )
}
