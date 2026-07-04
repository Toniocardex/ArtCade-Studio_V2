import type { AnimationClipDef, ImageAsset } from '../../types'

export type AssetDeleteKind = 'image' | 'audio' | 'font' | 'tileset'

export type DeleteAssetCommand = Readonly<{
  type: 'asset.delete'
  kind: AssetDeleteKind
  assetId: string
}>

export type RenameAssetCommand = Readonly<{
  type: 'asset.rename'
  kind: AssetDeleteKind
  assetId: string
  name: string
}>

export type PatchImageAssetCommand = Readonly<{
  type: 'asset.image.patch'
  assetId: string
  patch: Partial<ImageAsset>
}>

export type SetImageAssetClipsCommand = Readonly<{
  type: 'asset.image.setClips'
  assetId: string
  clips: AnimationClipDef[]
  coalesceKey?: string
}>

export type AssetAuthoringCommand =
  | DeleteAssetCommand
  | RenameAssetCommand
  | PatchImageAssetCommand
  | SetImageAssetClipsCommand

