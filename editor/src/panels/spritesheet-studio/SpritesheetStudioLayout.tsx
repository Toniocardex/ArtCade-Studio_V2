import type { ImageAsset } from '../../types'
import type { CollisionProfileDef } from '../../types'
import { getAssetDefaultPivot } from '../../utils/sprite-pivot-resolve'
import { AtlasGrid } from './AtlasGrid'
import { ClipListPanel } from './ClipListPanel'
import { SlicingPanel } from './SlicingPanel'
import { CollisionToolsPanel } from './collision/CollisionToolsPanel'
import { CollisionPropertiesPanel } from './collision/CollisionPropertiesPanel'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'
import type { ProjectDoc } from '../../types'

export type SpritesheetStudioMode = 'animations' | 'collision'

type SpritesheetStudioLayoutProps = Readonly<{
  asset: ImageAsset
  assetId: string
  project: ProjectDoc | null
  mode: SpritesheetStudioMode
  session: SpritesheetStudioSession
  profile: CollisionProfileDef
  activeShapeIndex: number
  onSelectShape: (index: number) => void
  onPatchDefaultPivot: (pivot: ImageAsset['defaultPivot']) => void
  onPatchProfile: (profile: CollisionProfileDef) => void
  onNewAnimation: () => void
}>

export function SpritesheetStudioLayout({
  asset,
  assetId,
  project,
  mode,
  session,
  profile,
  activeShapeIndex,
  onSelectShape,
  onPatchDefaultPivot,
  onPatchProfile,
  onNewAnimation,
}: SpritesheetStudioLayoutProps) {
  const activeClip = session.activeClip ?? session.draftClip ?? session.clips[0] ?? null
  const frameRect = activeClip?.frames?.[0] ?? null

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      {mode === 'animations' ? (
        <SlicingPanel
          asset={asset}
          session={session}
          onPatchDefaultPivot={onPatchDefaultPivot}
        />
      ) : (
        <CollisionToolsPanel
          profile={profile}
          activeShapeIndex={activeShapeIndex}
          onSelectShape={onSelectShape}
          onPatchProfile={onPatchProfile}
        />
      )}
      <AtlasGrid
        session={session}
        defaultPivot={getAssetDefaultPivot(asset)}
        interactionMode={mode}
        collisionProfile={mode === 'collision' ? profile : undefined}
        collisionActiveShapeIndex={activeShapeIndex}
        collisionFrameRect={frameRect}
        onPatchCollisionProfile={onPatchProfile}
      />
      {mode === 'animations' ? (
        <ClipListPanel
          asset={asset}
          assetId={assetId}
          session={session}
          onNewAnimation={onNewAnimation}
        />
      ) : (
        <CollisionPropertiesPanel
          project={project}
          profile={profile}
          activeShapeIndex={activeShapeIndex}
          onPatchProfile={onPatchProfile}
        />
      )}
    </div>
  )
}
