import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { SCENE_LAYER_ROWS } from '../../constants/scene-layers'
import { editorRowSelected } from '../ui/editor-ui-classes'

function layerRowClass(selected: boolean): string {
  return selected
    ? editorRowSelected
    : 'hover:bg-[var(--surface-hover)] text-[var(--primary)]'
}

/** UI-only layer reference (spec §4) until ProjectDoc gains a layer model. */
export function SceneLayersPanel() {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const selectionSceneId = useEditorSelector((s) => s.selection.sceneId)
  const selectedLayer = useEditorSelector((s) => s.inspectorLayerName)
  const sceneId = selectionSceneId ?? project?.activeSceneId
  const scene = sceneId && project ? project.scenes[sceneId] : undefined

  return (
    <div className="h-full overflow-auto p-2 text-[10px]">
      <p className="text-[var(--muted)] mb-2 px-1">
        Layer ordering for <strong className="text-[var(--primary)]">{scene?.name ?? 'scene'}</strong>.
        Assign entities via Inspector (Layer field).
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[var(--muted)] uppercase tracking-wide text-[8px]">
            <th className="text-left py-1">Layer</th>
            <th className="text-right py-1">Order</th>
          </tr>
        </thead>
        <tbody>
          {SCENE_LAYER_ROWS.map((row) => {
            const active = selectedLayer === row.name
            return (
              <tr
                key={row.name}
                className={`border-t border-[var(--outline-faint)] cursor-pointer ${layerRowClass(active)}`}
                onClick={() => {
                  dispatch({
                    type: 'SELECT_INSPECTOR_LAYER',
                    layerName: active ? null : row.name,
                  })
                  if (!active) {
                    dispatch({ type: 'SET_EDITOR_ACTIVE_LAYER', layerName: row.name })
                  }
                }}
              >
                <td className="py-1.5 px-1">{row.name}</td>
                <td className="py-1.5 text-right font-mono pr-1">{row.order}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
