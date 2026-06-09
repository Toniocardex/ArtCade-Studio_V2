import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { SCENE_LAYER_NAMES } from '../../constants/scene-layers'

/** Canvas toolbar — active layer (UI-only, synced with Layers panel). */
export function ActiveLayerSelect() {
  const dispatch = useEditorDispatch()
  const value = useEditorSelector((s) => s.editorActiveLayer)

  return (
    <label className="flex items-center gap-1.5 text-[9px] text-[var(--muted)] shrink-0">
      <span className="uppercase tracking-wide font-semibold">Layer</span>
      <select
        className="editor-input !w-auto !min-w-[6.5rem] font-ui"
        value={value}
        onChange={(e) =>
          dispatch({ type: 'SET_EDITOR_ACTIVE_LAYER', layerName: e.target.value })
        }
        title="Active layer for authoring (UI-only until layer model ships)"
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
