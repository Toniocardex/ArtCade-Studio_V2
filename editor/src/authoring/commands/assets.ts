import type {
  AnimationClipDef,
  AssetFolderCategory,
  AudioAsset,
  FontAsset,
  ImageAsset,
  ImageAssetUsage,
} from '../../types'
import type { TilesetAsset } from '../../types/tilemap'

export type AssetDeleteKind = 'image' | 'audio' | 'font' | 'tileset'
export type AssetRefKind = AssetDeleteKind

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

export type CreateAssetFolderCommand = Readonly<{
  type: 'asset.folder.create'
  category: AssetFolderCategory
  name: string
  usage?: ImageAssetUsage
}>

export type RenameAssetFolderCommand = Readonly<{
  type: 'asset.folder.rename'
  folderId: string
  name: string
}>

export type MoveAssetToFolderCommand = Readonly<{
  type: 'asset.folder.moveAsset'
  folderId: string
  assetType: AssetRefKind
  assetId: string
}>

export type UnassignAssetFromFoldersCommand = Readonly<{
  type: 'asset.folder.unassignAsset'
  assetType: AssetRefKind
  assetId: string
}>

export type DeleteAssetFolderCommand = Readonly<{
  type: 'asset.folder.delete'
  folderId: string
}>

export type SetImageAssetUsageCommand = Readonly<{
  type: 'asset.image.setUsage'
  assetId: string
  usage: ImageAssetUsage
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
  | CreateAssetFolderCommand
  | RenameAssetFolderCommand
  | MoveAssetToFolderCommand
  | UnassignAssetFromFoldersCommand
  | DeleteAssetFolderCommand
  | SetImageAssetUsageCommand

