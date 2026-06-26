import type { ImageAsset, ProjectDoc } from '../../types'
import { resolveImageAssetDataUrl } from '../../utils/prototype-sprite-resolve'
import { AssetTreeThumbnail } from './AssetTreeThumbnail'

type ImageTreeThumbnailProps = Readonly<{
  asset: ImageAsset | undefined
  project?: ProjectDoc | null
  projectPath: string | null
  onOpenStudio: () => void
}>

/** Small tree icon; double-click opens Spritesheet Studio without re-firing row activation. */
export function ImageTreeThumbnail({ asset, project, projectPath, onOpenStudio }: ImageTreeThumbnailProps) {
  return (
    <AssetTreeThumbnail
      path={asset?.path}
      dataUrl={resolveImageAssetDataUrl(asset, project)}
      projectPath={projectPath}
      onOpen={onOpenStudio}
      openOn="double-click"
      openTitle="Double-click to open Sprite Studio"
    />
  )
}
