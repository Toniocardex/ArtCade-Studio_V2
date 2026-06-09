import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { SCENE_LAYER_NAMES } from '../../constants/scene-layers'
import type { EntityDef } from '../../types'

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
      <select
        className="editor-input font-ui mt-0.5"
        value={value}
        onChange={(e) =>
          dispatch({
            type: 'ENTITY_SET_DISPLAY_LAYER',
            entityId: entity.id,
            layerName: e.target.value,
          })
        }
      >
        {SCENE_LAYER_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}
