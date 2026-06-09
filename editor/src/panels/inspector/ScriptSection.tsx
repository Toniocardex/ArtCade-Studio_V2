import { useEditorDispatch, useEditorStore } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { Field, InspectorSection } from './inspector-fields'
import { openProjectScript } from '../../utils/open-project-script'

export type ScriptSectionProps = Readonly<{
  entity: EntityDef
}>

export function ScriptSection({ entity }: ScriptSectionProps) {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  if (!entity.scriptPath) return null
  const scriptPath = entity.scriptPath

  function openInEditor() {
    const { projectPath, openScripts } = store.getState()
    void openProjectScript(dispatch, {
      projectPath,
      openScripts,
    }, scriptPath)
  }

  return (
    <InspectorSection label="Script">
      <Field label="Path" value={scriptPath} />
      <button
        onClick={openInEditor}
        className="w-full mt-1 px-3 py-1 bg-[rgb(var(--accent-2-rgb)/0.1)] border border-[rgb(var(--accent-2-rgb)/0.4)]
                   text-[var(--accent-2)] text-[10px] font-bold rounded hover:bg-[rgb(var(--accent-2-rgb)/0.2)]
                   transition-colors"
      >
        OPEN IN SCRIPT EDITOR →
      </button>
    </InspectorSection>
  )
}
