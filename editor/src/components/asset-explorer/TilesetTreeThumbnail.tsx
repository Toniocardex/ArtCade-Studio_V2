import type { TilesetAsset } from '../../types/tilemap'
import { AssetTreeThumbnail } from './AssetTreeThumbnail'

type TilesetTreeThumbnailProps = Readonly<{
  tileset: TilesetAsset | undefined
  projectPath: string | null
  onOpenEditor: () => void
}>

/** Small tree icon for tilesets; double-click opens Tileset Editor. */
export function TilesetTreeThumbnail({
  tileset,
  projectPath,
  onOpenEditor,
}: TilesetTreeThumbnailProps) {
  return (
    <AssetTreeThumbnail
      path={tileset?.spriteImagePath}
      dataUrl={tileset?.previewDataUrl}
      projectPath={projectPath}
      onOpen={onOpenEditor}
      openTitle="Double-click to open Tileset Editor"
    />
  )
}
