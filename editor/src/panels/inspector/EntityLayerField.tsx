import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { DEFAULT_LAYERS } from '../../constants/scene-layers'
import { EditorSelect } from '../../components/ui/EditorSelect'
import type { EntityDef } from '../../types'

export type EntityLayerFieldProps = Readonly<{
  entity: EntityDef
}>

export function EntityLayerField({ entity }: EntityLayerFieldProps) {
  const dispatch = useEditorDispatch()
  const layers = useEditorSelector((s) => s.project?.layers ?? DEFAULT_LAYERS)
  const entityDisplayLayers = useEditorSelector((s) => s.entityDisplayLayers)
  const editorActiveLayer = useEditorSelector((s) => s.editorActiveLayer)
  const value = entityDisplayLayers[entity.id] ?? entity.layer ?? editorActiveLayer

  const options = layers.map((l) => ({ value: l.name, label: l.name }))

  return (
    <label className="block mb-2">
      <span className="text-[9px] text-[var(--muted)] uppercase">Layer</span>
      <EditorSelect
        className="w-full font-ui mt-0.5"
        value={value}
        onChange={(layerName) =>
          dispatch({
            type: 'ENTITY_SET_DISPLAY_LAYER',
            entityId: entity.id,
            layerName,
          })
        }
        options={options}
      />
    </label>
  )
}
