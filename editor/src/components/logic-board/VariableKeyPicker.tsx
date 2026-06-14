import { useEditorSelector } from '../../store/editor-store'
import {
  buildVariablePickerOptions,
  selectGlobalVariables,
  variablePickerOptionsEqual,
} from '../../store/editor-selectors'
import { EditorSelect } from '../ui/EditorSelect'

export function VariableKeyPicker({
  scope,
  value,
  onChange,
}: Readonly<{
  scope: 'global' | 'local'
  value: string
  onChange: (value: string) => void
}>) {
  const options = useEditorSelector((state) => {
    const definitions = scope === 'global'
      ? selectGlobalVariables(state)
      : Object.values(state.project?.objectTypes ?? {}).flatMap((type) => type.localVariables ?? [])
    return buildVariablePickerOptions(definitions)
  }, variablePickerOptionsEqual)

  return (
    <EditorSelect
      className="w-auto min-w-28"
      triggerClassName="py-1"
      value={value}
      onChange={onChange}
      options={options}
      placeholder={options.length ? 'Choose variable' : 'No declared variables'}
      aria-label={`${scope} variable`}
    />
  )
}
