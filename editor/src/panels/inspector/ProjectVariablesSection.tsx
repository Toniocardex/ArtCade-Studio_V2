import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { InspectorSection } from './inspector-fields'
import { VariableDefinitionsEditor } from './VariableDefinitionsEditor'

export function ProjectVariablesSection() {
  const dispatch = useEditorDispatch()
  const variables = useEditorSelector((state) => state.project?.globalVariables ?? [])
  return (
    <InspectorSection label="Project Variables" defaultOpen>
      <p className="mb-2 text-[10px] text-[var(--muted)]">Shared by every scene and saved with the game state.</p>
      <VariableDefinitionsEditor
        variables={variables}
        onChange={(next) => dispatch({ type: 'PROJECT_VARIABLES_SET', variables: next })}
      />
    </InspectorSection>
  )
}
