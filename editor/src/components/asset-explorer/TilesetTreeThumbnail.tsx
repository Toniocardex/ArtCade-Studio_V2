import type { TilesetAsset } from '../../types/tilemap'
import { AssetTreeThumbnail } from './AssetTreeThumbnail'

type TilesetTreeThumbnailProps = Readonly<{
  tileset: TilesetAsset | undefined
  projectPath: string | null
  onOpenEditor: () => void
}>

/** Small tree icon for tilesets; click opens Tileset Editor. */
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
      openTitle="Click to open Tileset Editor"
    />
  )
}
