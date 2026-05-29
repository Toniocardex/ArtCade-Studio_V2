import type { ImageAsset } from '../../types'
import { AtlasGrid } from './AtlasGrid'
import { ClipListPanel } from './ClipListPanel'
import { ClipPreviewPane } from './ClipPreviewPane'
import { SlicingPanel } from './SlicingPanel'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'

type SpritesheetStudioLayoutProps = Readonly<{
  asset: ImageAsset
  assetId: string
  session: SpritesheetStudioSession
}>

export function SpritesheetStudioLayout({ asset, assetId, session }: SpritesheetStudioLayoutProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <div className="flex flex-1 min-h-0 min-w-0">
        <SlicingPanel session={session} />
        <AtlasGrid session={session} />
        <ClipListPanel assetId={assetId} session={session} />
      </div>
      <ClipPreviewPane asset={asset} session={session} />
    </div>
  )
}
