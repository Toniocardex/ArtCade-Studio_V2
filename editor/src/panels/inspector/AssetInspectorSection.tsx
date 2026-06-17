import type { AssetExplorerSelection } from '../../hooks/useAssetExplorerActions'
import { AssetDetailStrip } from '../../components/asset-explorer/AssetDetailStrip'
import { AssetMediaDetailStrip } from '../../components/asset-explorer/AssetMediaDetailStrip'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { EditorButton } from '../../components/ui/EditorButton'

export type AssetInspectorSectionProps = Readonly<{
  selection: AssetExplorerSelection
}>

export function AssetInspectorSection({ selection }: AssetInspectorSectionProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)

  if (!project) {
    return (
      <p className="text-[10px] text-[var(--muted)] py-4">Open a project to inspect assets.</p>
    )
  }

  if (selection.type === 'tileset') {
    const tileset = project.tilesets?.[selection.id]
    return (
      <div className="space-y-3 text-[10px]">
        <p className="text-[var(--primary)] font-semibold">{tileset?.name ?? selection.id}</p>
        <p className="text-[var(--muted)]">
          Tile: {tileset?.tileSize ?? '?'}px · grid {tileset?.cols ?? '?'}×{tileset?.rows ?? '?'}
        </p>
        <EditorButton
          type="button"
          className="w-full !text-[10px]"
          onClick={() => dispatch({ type: 'TILESET_PAINT_BEGIN', tilesetId: selection.id })}
        >
          Open Tileset Editor
        </EditorButton>
      </div>
    )
  }

  if (selection.type === 'image') {
    return (
      <div className="-mx-4 -mt-1">
        <AssetDetailStrip selection={selection} />
      </div>
    )
  }

  return (
    <div className="-mx-4 -mt-1">
      <AssetMediaDetailStrip selection={selection} />
    </div>
  )
}
