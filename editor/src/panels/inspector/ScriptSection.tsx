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
        type="button"
        onClick={openInEditor}
        className="w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]"
      >
        Open in Script Editor
      </button>
    </InspectorSection>
  )
}
