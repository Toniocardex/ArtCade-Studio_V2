import type { ImageAsset, ImageAssetUsage } from '../types'
import { importAssetFile, type ImportedAssetFile } from './asset-file-api'

export type ImportedImageAsset = Readonly<{
  asset: ImageAsset
  imported: ImportedAssetFile
}>

function fileReaderDataUrl(result: string | ArrayBuffer | null): string {
  return typeof result === 'string' ? result : ''
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(fileReaderDataUrl(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

export async function importImageAssetFromFile({
  file,
  projectRoot,
  rejectContentHashes,
  usage,
}: Readonly<{
  file: File
  projectRoot: string | null
  rejectContentHashes?: ReadonlySet<string>
  usage: ImageAssetUsage
}>): Promise<ImportedImageAsset> {
  const [dataUrl, bytes] = await Promise.all([
    readFileAsDataUrl(file),
    file.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
  ])
  const imported = await importAssetFile({
    kind: 'image',
    fileName: file.name,
    bytes,
    projectRoot,
    rejectContentHashes,
  })
  return {
    imported,
    asset: {
      id: imported.id,
      name: file.name,
      path: imported.path,
      usage,
      contentHash: imported.contentHash,
      dataUrl,
    },
  }
}
