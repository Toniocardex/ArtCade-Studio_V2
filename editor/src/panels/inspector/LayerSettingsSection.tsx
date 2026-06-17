import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { layerTilesetId } from '../../utils/tileset-paint-session'

export type LayerSettingsSectionProps = Readonly<{
  layerName: string
  sceneName: string | undefined
}>

export function LayerSettingsSection({ layerName, sceneName }: LayerSettingsSectionProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const sceneId = useEditorSelector((s) => s.selection.sceneId ?? s.project?.activeSceneId)
  const tilesetId = layerTilesetId(project, sceneId, layerName)
  const tileset = tilesetId ? project?.tilesets?.[tilesetId] : undefined

  return (
    <div className="space-y-3 text-[10px] text-[var(--primary-soft)]">
      <p>
        Layer <strong className="text-[var(--primary)]">{layerName}</strong>
        {sceneName ? (
          <> in <strong className="text-[var(--primary)]">{sceneName}</strong></>
        ) : null}
      </p>
      <div className="space-y-1">
        <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider">Tileset</span>
        {tileset ? (
          <p className="text-[var(--text)]">
            <strong className="text-[var(--primary)]">{tileset.name}</strong>
            <span className="text-[var(--muted)]">{` · ${tileset.cols}×${tileset.rows} @ ${tileset.tileSize}px`}</span>
          </p>
        ) : (
          <p className="text-[var(--muted)]">No tileset assigned to this layer.</p>
        )}
      </div>
      {tilesetId && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'TILESET_EDIT_OPEN', tilesetId })}
          className="w-full px-3 py-2 rounded text-xs font-semibold border border-[var(--accent-bd)]
                     bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
        >
          Paint with this tileset
        </button>
      )}
      <p className="text-[var(--muted)] leading-relaxed">
        Rename or reorder layers in the Layers panel (left sidebar).
        Assign entities to a layer via the Layer field in the Inspector.
      </p>
    </div>
  )
}
