import type { AnimationClipDef, AudioAsset, FontAsset, ImageAsset } from '../../types'
import type { TilesetAsset } from '../../types/tilemap'

export type AssetDeleteKind = 'image' | 'audio' | 'font' | 'tileset'

export type DeleteAssetCommand = Readonly<{
  type: 'asset.delete'
  kind: AssetDeleteKind
  assetId: string
}>

export type UpsertImageAssetCommand = Readonly<{
  type: 'asset.image.upsert'
  asset: ImageAsset
}>

export type UpsertAudioAssetCommand = Readonly<{
  type: 'asset.audio.upsert'
  asset: AudioAsset
}>

export type UpsertFontAssetCommand = Readonly<{
  type: 'asset.font.upsert'
  asset: FontAsset
}>

export type UpsertTilesetAssetCommand = Readonly<{
  type: 'asset.tileset.upsert'
  asset: TilesetAsset
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
  | UpsertImageAssetCommand
  | UpsertAudioAssetCommand
  | UpsertFontAssetCommand
  | UpsertTilesetAssetCommand
  | RenameAssetCommand
  | PatchImageAssetCommand
  | SetImageAssetClipsCommand

