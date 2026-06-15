import { useEditorDispatch, useEditorSelector, shallowEqual } from '../../store/editor-store'
import { selectGlobalVariables } from '../../store/editor-selectors'
import { InspectorSection } from './inspector-fields'
import { VariableDefinitionsEditor } from './VariableDefinitionsEditor'

export function ProjectVariablesSection() {
  const dispatch = useEditorDispatch()
  const variables = useEditorSelector(selectGlobalVariables, shallowEqual)
  return (
    <InspectorSection label="Global Variables" labelBadge={{ text: 'GLOBAL', color: 'blue' }} defaultOpen>
      <p className="mb-2 text-[10px] text-[var(--muted)]">
        Shared across every object and scene. Use them for score, lives, game state — anything
        that isn't private to a single object.
        Reference them in Logic Board rules with scope&nbsp;<strong>Global</strong>.
      </p>
      <VariableDefinitionsEditor
        variables={variables}
        onChange={(next) => dispatch({ type: 'PROJECT_VARIABLES_SET', variables: next })}
      />
    </InspectorSection>
  )
}
