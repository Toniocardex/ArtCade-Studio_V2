import { useEditorDispatch, useEditorSelector, shallowEqual } from '../../store/editor-store'
import { selectGlobalVariables } from '../../store/editor-selectors'
import { InspectorSection } from './inspector-fields'
import { VariableDefinitionsEditor } from './VariableDefinitionsEditor'

export function ProjectVariablesSection() {
  const dispatch = useEditorDispatch()
  const variables = useEditorSelector(selectGlobalVariables, shallowEqual)
  return (
    <InspectorSection
      label="Global Variables"
      labelBadge={{ text: 'GLOBAL', color: 'blue' }}
      tooltip="Shared across every object and scene. Use for score, lives, game state — anything not private to a single object. Reference in Logic Board rules with scope Global."
      defaultOpen
    >
      <VariableDefinitionsEditor
        variables={variables}
        onChange={(next) => dispatch({ type: 'PROJECT_VARIABLES_SET', variables: next })}
      />
    </InspectorSection>
  )
}
