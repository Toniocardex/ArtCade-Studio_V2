import { useState } from 'react'
import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import type { InspectorBlockKey } from './entity-component-utils'
import { Field } from './inspector-fields'
import { activeComponentDescriptors } from './entity-component-utils'
import { EntityTagsSection } from './EntityTagsSection'

export type EntityHeaderBarProps = Readonly<{
  entity: EntityDef
  onJumpToComponent: (key: InspectorBlockKey) => void
}>

export function EntityHeaderBar({
  entity,
  onJumpToComponent,
}: EntityHeaderBarProps) {
  const { dispatch } = useEditor()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const active = activeComponentDescriptors(entity)

  return (
    <div
      className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 mb-1
                 bg-[var(--panel)] border-b border-[var(--border)]"
    >
      <Field
        label="Entity Name"
        value={entity.name}
        cyan
        onCommit={(name) =>
          dispatch({ type: 'ENTITY_SET_NAME', entityId: entity.id, name })
        }
      />
      <p className="text-[9px] text-[var(--muted)] -mt-1 mb-2 leading-snug">
        Shown in the Scenes panel and Logic Board. Rules are per entity, not per name.
      </p>

      {active.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {active.map((desc) => (
            <button
              key={desc.key}
              type="button"
              title={`Jump to ${desc.label}`}
              onClick={() => onJumpToComponent(desc.key)}
              className="text-[9px] font-bold px-2 py-0.5 rounded border
                         bg-[rgb(var(--border-rgb)/0.35)] hover:bg-[rgb(var(--border-rgb)/0.55)]
                         transition-colors uppercase tracking-wide"
              style={{ color: desc.color, borderColor: desc.color }}
            >
              {desc.label}
            </button>
          ))}
        </div>
      )}

      <EntityTagsSection entity={entity} />

      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={entity.visible !== false}
          onChange={(e) =>
            dispatch({
              type: 'ENTITY_SET_VISIBLE',
              entityId: entity.id,
              visible: e.target.checked,
            })
          }
          className="accent-[var(--accent)]"
        />
        <span className="text-xs text-[var(--text)]">Visible in game</span>
      </label>
      <p className="text-[9px] text-[var(--muted)] -mt-1 mb-2 leading-snug">
        Hidden entities appear dimmed in the editor preview with an amber outline. Use Logic Board Set Visible for runtime effects.
      </p>

      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="text-xs border border-[var(--border)] rounded-lg px-3 py-2"
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
    </div>
  )
}
