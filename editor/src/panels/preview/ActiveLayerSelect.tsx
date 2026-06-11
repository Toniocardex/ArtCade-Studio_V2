import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { DEFAULT_LAYERS } from '../../constants/scene-layers'
import { EditorSelect } from '../../components/ui/EditorSelect'

/** Canvas toolbar — active layer for authoring, synced with the Layers panel. */
export function ActiveLayerSelect() {
  const dispatch = useEditorDispatch()
  const layers = useEditorSelector((s) => s.project?.layers ?? DEFAULT_LAYERS)
  const value = useEditorSelector((s) => s.editorActiveLayer)

  const options = layers.map((l) => ({ value: l.name, label: l.name }))

  return (
    <label className="flex items-center gap-1.5 text-[9px] text-[var(--muted)] shrink-0">
      <span className="uppercase tracking-wide font-semibold">Layer</span>
      <EditorSelect
        className="min-w-[6.5rem] font-ui"
        triggerClassName="py-1"
        value={value}
        onChange={(layerName) =>
          dispatch({ type: 'SET_EDITOR_ACTIVE_LAYER', layerName })
        }
        options={options}
        aria-label="Active layer"
      />
    </label>
  )
}
