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
        className="w-full mt-1 px-3 py-1 bg-[var(--accent-bg)] border border-[var(--accent-bd)]
                   text-[var(--accent)] text-[10px] font-bold rounded hover:bg-[var(--accent-bg-h)]
                   transition-colors"
      >
        OPEN IN SCRIPT EDITOR →
      </button>
    </InspectorSection>
  )
}
