import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { sourcesUsedOnLayer } from '../../utils/tilemap-layer-sources'

export type LayerSettingsSectionProps = Readonly<{
  layerName: string
  sceneName: string | undefined
}>

export function LayerSettingsSection({ layerName, sceneName }: LayerSettingsSectionProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const sceneId = useEditorSelector((s) => s.selection.sceneId ?? s.project?.activeSceneId)
  const layer = sceneId ? project?.scenes[sceneId]?.tilemapLayers?.[layerName] : undefined
  const usedIds = layer ? sourcesUsedOnLayer(layer) : []

  return (
    <div className="space-y-3 text-[10px] text-[var(--primary-soft)]">
      <p>
        Layer <strong className="text-[var(--primary)]">{layerName}</strong>
        {sceneName ? (
          <> in <strong className="text-[var(--primary)]">{sceneName}</strong></>
        ) : null}
      </p>
      <div className="space-y-1">
        <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider">Tileset sources</span>
        {usedIds.length > 0 ? (
          <ul className="space-y-1">
            {usedIds.map((id) => {
              const tileset = project?.tilesets?.[id]
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text)] truncate">
                    {tileset?.name ?? id}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'TILESET_PAINT_BEGIN', tilesetId: id })}
                    className="shrink-0 text-[9px] text-[var(--accent)] hover:underline"
                  >
                    Paint
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[var(--muted)]">No tilesets used on this layer yet.</p>
        )}
      </div>
      <p className="text-[var(--muted)] leading-relaxed">
        Rename or reorder layers in the Layers panel (left sidebar).
        Assign entities to a layer via the Layer field in the Inspector.
      </p>
    </div>
  )
}
