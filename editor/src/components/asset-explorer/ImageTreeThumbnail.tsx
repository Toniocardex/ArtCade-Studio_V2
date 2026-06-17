import type { ImageAsset } from '../../types'
import { AssetTreeThumbnail } from './AssetTreeThumbnail'

type ImageTreeThumbnailProps = Readonly<{
  asset: ImageAsset | undefined
  projectPath: string | null
  onOpenStudio: () => void
}>

/** Small tree icon; double-click opens Spritesheet Studio without triggering row double-click. */
export function ImageTreeThumbnail({ asset, projectPath, onOpenStudio }: ImageTreeThumbnailProps) {
  return (
    <AssetTreeThumbnail
      path={asset?.path}
      dataUrl={asset?.dataUrl}
      projectPath={projectPath}
      onOpen={onOpenStudio}
      openTitle="Double-click to open Sprite Studio"
    />
  )
}
