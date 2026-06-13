import { useEditorSelector } from '../../store/editor-store'
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
      ? state.project?.globalVariables ?? []
      : Object.values(state.project?.objectTypes ?? {}).flatMap((type) => type.localVariables ?? [])
    return [...new Map(definitions.map((definition) => [definition.key, definition])).values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((definition) => ({ value: definition.key, label: definition.key }))
  })
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
