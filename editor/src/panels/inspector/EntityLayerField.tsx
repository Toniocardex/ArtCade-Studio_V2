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
  const editorActiveLayerId = useEditorSelector((s) => s.editorActiveLayerId)
  const fallbackId = layers.some((l) => l.id === editorActiveLayerId)
    ? editorActiveLayerId
    : layers[0]?.id ?? ''
  const value = entity.layerId ?? fallbackId

  const options = layers.map((l) => ({ value: l.id, label: l.name }))

  return (
    <label className="block mb-2">
      <span className="text-[9px] text-[var(--muted)] uppercase">Layer</span>
      <EditorSelect
        className="w-full font-ui mt-0.5"
        value={value}
        onChange={(layerId) =>
          dispatch({
            type: 'INSTANCE_SET_LAYER',
            instanceId: entity.id,
            layerId,
          })
        }
        options={options}
      />
    </label>
  )
}
