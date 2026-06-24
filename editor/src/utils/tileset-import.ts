import type { TilesetAsset } from '../types/tilemap'
import { importAssetFile, type ImportedAssetFile } from './asset-file-api'

export interface BuildTilesetFromImageFileOptions {
  file: File
  bytes: Uint8Array
  naturalWidth: number
  naturalHeight: number
  previewDataUrl: string
  projectRoot?: string | null
  rejectContentHashes?: ReadonlySet<string>
  tileSize?: number
  margin?: number
}

export interface BuildTilesetFromImageFileResult {
  tileset: TilesetAsset
  imported: ImportedAssetFile
}

/**
 * Imports a tileset image under assets/tilesets/ and builds a TilesetAsset.
 * Does not register an ImageAsset in project.assets.
 */
export async function buildTilesetFromImageFile(
  options: BuildTilesetFromImageFileOptions,
): Promise<BuildTilesetFromImageFileResult> {
  const tileSize = options.tileSize ?? 32
  const margin = options.margin ?? 0
  const step = tileSize + margin
  const cols = Math.max(1, Math.floor((options.naturalWidth + margin) / step))
  const rows = Math.max(1, Math.floor((options.naturalHeight + margin) / step))

  const imported = await importAssetFile({
    kind: 'tileset',
    fileName: options.file.name,
    bytes: options.bytes,
    projectRoot: options.projectRoot,
    rejectContentHashes: options.rejectContentHashes,
  })

  const tileset: TilesetAsset = {
    assetId: `tileset_${Date.now().toString(36)}`,
    name: options.file.name.replace(/\.[^.]+$/, ''),
    spriteImagePath: imported.path,
    contentHash: imported.contentHash,
    tileSize,
    margin,
    cols,
    rows,
    previewDataUrl: options.previewDataUrl,
  }

  return { tileset, imported }
}
