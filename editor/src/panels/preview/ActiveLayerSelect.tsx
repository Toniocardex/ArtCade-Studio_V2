import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { SCENE_LAYER_NAMES } from '../../constants/scene-layers'
import { EditorSelect } from '../../components/ui/EditorSelect'

const LAYER_OPTIONS = SCENE_LAYER_NAMES.map((name) => ({ value: name, label: name }))

/** Canvas toolbar — active layer (UI-only, synced with Layers panel). */
export function ActiveLayerSelect() {
  const dispatch = useEditorDispatch()
  const value = useEditorSelector((s) => s.editorActiveLayer)

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
        options={LAYER_OPTIONS}
        title="Active layer for authoring (UI-only until layer model ships)"
        aria-label="Active layer"
      />
    </label>
  )
}
