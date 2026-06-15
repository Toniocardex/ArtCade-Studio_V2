import type { EntityDef, GameVariableValue } from '../../types'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { findSceneInstance } from '../../utils/project-object-types'
import { InspectorSection } from './inspector-fields'
import { VariableDefinitionsEditor } from './VariableDefinitionsEditor'

export function ObjectVariablesSection({ entity }: Readonly<{ entity: EntityDef }>) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((state) => state.project)
  if (!project) return null
  const found = findSceneInstance(project, entity.id)
  if (!found) return null
  const objectType = project.objectTypes?.[found.instance.objectTypeId]
  if (!objectType) return null
  const variables = objectType.localVariables ?? []
  const overrides = found.instance.localVariableOverrides ?? {}
  const setOverrides = (next: Record<string, GameVariableValue>) => dispatch({
    type: 'INSTANCE_VARIABLE_OVERRIDES_SET',
    sceneId: found.sceneId,
    instanceId: entity.id,
    overrides: next,
  })

  return (
    <InspectorSection
      label="Local Variables"
      labelBadge={{ text: 'LOCAL', color: 'green' }}
      defaultOpen
    >
      <p className="mb-2 text-[10px] text-[var(--muted)]">
        Private to this object. Each instance in the scene keeps its own independent copy.
        Reference them in Logic Board rules with scope&nbsp;<strong>Local</strong>.
      </p>
      <VariableDefinitionsEditor
        variables={variables}
        onChange={(next) => dispatch({
          type: 'OBJECT_TYPE_VARIABLES_SET',
          objectTypeId: objectType.id,
          variables: next,
        })}
      />
      {variables.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-1">
            Starting values for this instance
          </p>
          <p className="text-[9px] text-[var(--muted)] mb-2">
            Override the initial value for this specific instance only.
          </p>
          {variables.map((variable) => (
            <label key={variable.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-1 text-xs">
              <span className="truncate">{variable.key}</span>
              <input
                className={variable.type === 'boolean' ? 'justify-self-start' : 'editor-input'}
                type={variable.type === 'number' ? 'number' : variable.type === 'boolean' ? 'checkbox' : 'text'}
                checked={variable.type === 'boolean' ? Boolean(overrides[variable.key] ?? variable.initialValue) : undefined}
                value={variable.type === 'boolean' ? undefined : String(overrides[variable.key] ?? variable.initialValue)}
                onChange={(event) => setOverrides({
                  ...overrides,
                  [variable.key]: variable.type === 'boolean'
                    ? event.target.checked
                    : variable.type === 'number'
                      ? Number(event.target.value) || 0
                      : event.target.value,
                })}
              />
              <button
                type="button"
                className="text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                onClick={() => {
                  const next = { ...overrides }
                  delete next[variable.key]
                  setOverrides(next)
                }}
              >
                Reset
              </button>
            </label>
          ))}
        </div>
      )}
    </InspectorSection>
  )
}
