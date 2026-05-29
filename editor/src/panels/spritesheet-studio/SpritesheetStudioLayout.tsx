import type { ImageAsset } from '../../types'
import { AtlasGrid } from './AtlasGrid'
import { ClipListPanel } from './ClipListPanel'
import { SlicingPanel } from './SlicingPanel'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'

type SpritesheetStudioLayoutProps = Readonly<{
  asset: ImageAsset
  assetId: string
  session: SpritesheetStudioSession
  onPatchDefaultPivot: (pivot: ImageAsset['defaultPivot']) => void
}>

export function SpritesheetStudioLayout({
  asset,
  assetId,
  session,
  onPatchDefaultPivot,
}: SpritesheetStudioLayoutProps) {
  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <SlicingPanel
        asset={asset}
        session={session}
        onPatchDefaultPivot={onPatchDefaultPivot}
      />
      <AtlasGrid session={session} />
      <ClipListPanel asset={asset} assetId={assetId} session={session} />
    </div>
  )
}
