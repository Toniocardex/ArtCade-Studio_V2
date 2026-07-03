export type AssetDeleteKind = 'image' | 'audio' | 'font' | 'tileset'

export type DeleteAssetCommand = Readonly<{
  type: 'asset.delete'
  kind: AssetDeleteKind
  assetId: string
}>

export type AssetAuthoringCommand = DeleteAssetCommand

