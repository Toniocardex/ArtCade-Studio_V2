import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { Field, InspectorSection } from './inspector-fields'

export function ScriptSection({ entity }: { entity: EntityDef }) {
  const { dispatch } = useEditor()
  if (!entity.scriptPath) return null

  return (
    <InspectorSection label="Script">
      <Field label="Path" value={entity.scriptPath} />
      <button
        onClick={() => dispatch({
          type: 'OPEN_SCRIPT',
          file: { path: entity.scriptPath!, content: '', isDirty: false },
        })}
        className="w-full mt-1 px-3 py-1 bg-[rgb(var(--accent-2-rgb)/0.1)] border border-[rgb(var(--accent-2-rgb)/0.4)]
                   text-[var(--accent-2)] text-[10px] font-bold rounded hover:bg-[rgb(var(--accent-2-rgb)/0.2)]
                   transition-colors"
      >
        OPEN IN SCRIPT EDITOR →
      </button>
    </InspectorSection>
  )
}
