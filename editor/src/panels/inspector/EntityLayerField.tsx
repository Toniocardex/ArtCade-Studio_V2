import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { SCENE_LAYER_NAMES } from '../../constants/scene-layers'
import { EditorSelect } from '../../components/ui/EditorSelect'
import type { EntityDef } from '../../types'

const LAYER_OPTIONS = SCENE_LAYER_NAMES.map((name) => ({ value: name, label: name }))

export type EntityLayerFieldProps = Readonly<{
  entity: EntityDef
}>

export function EntityLayerField({ entity }: EntityLayerFieldProps) {
  const dispatch = useEditorDispatch()
  const entityDisplayLayers = useEditorSelector((s) => s.entityDisplayLayers)
  const editorActiveLayer = useEditorSelector((s) => s.editorActiveLayer)
  const value = entityDisplayLayers[entity.id] ?? editorActiveLayer

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
        options={LAYER_OPTIONS}
      />
    </label>
  )
}
