import { useState } from 'react'
import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { Field, InspectorSection } from './inspector-fields'

export function EntitySettingsSection({ entity }: { entity: EntityDef }) {
  const { dispatch } = useEditor()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function openLogicBoard() {
    dispatch({ type: 'SELECT_ENTITY', entityId: entity.id })
    dispatch({ type: 'SET_MODE', mode: 'logic' })
  }

  return (
    <InspectorSection label="Entity Settings" defaultOpen>
      <Field
        label="Entity Name"
        value={entity.name}
        cyan
        onCommit={(name) =>
          dispatch({ type: 'ENTITY_SET_NAME', entityId: entity.id, name })
        }
      />
      <p className="text-[9px] text-[var(--muted)] -mt-1 mb-2 leading-snug">
        Shown in Hierarchy and Logic Board. Rules are per entity, not per name.
      </p>

      <button
        type="button"
        onClick={openLogicBoard}
        className="w-full mb-3 px-3 py-1.5 rounded text-xs font-semibold border border-[var(--accent-bd)]
                   bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
      >
        Open Logic Board
      </button>

      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="mb-3 text-xs border border-[var(--border)] rounded-lg px-3 py-2"
      >
        <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)] select-none font-bold uppercase text-[9px] tracking-widest">
          Advanced
        </summary>
        <div className="mt-2">
          <Field
            label="Spawn group (className)"
            value={entity.className}
            onCommit={(className) =>
              dispatch({ type: 'ENTITY_SET_CLASSNAME', entityId: entity.id, className })
            }
          />
          <p className="text-[9px] text-[var(--muted)] leading-snug">
            Runtime pools, spawn, and collision widgets use this. Logic Board rules do not.
          </p>
        </div>
      </details>

      <div className="flex flex-wrap gap-1 mb-3">
        {entity.tags.map(t => (
          <span key={t} className="bg-[var(--border)] border border-[var(--border-2)] text-[var(--muted)]
                                   text-[9px] px-2 py-0.5 rounded">
            #{t}
          </span>
        ))}
      </div>
    </InspectorSection>
  )
}
