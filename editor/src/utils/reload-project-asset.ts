import { readProjectFileBytes } from './asset-file-api'
import { editorInvalidateAsset, editorRegisterAudio, editorRegisterImage } from './wasm-bridge'
import { registerKeyForDescriptor } from './asset-orchestrator'
import type { AudioAsset, ImageAsset } from '../types'

function extFromPath(path: string): string {
  const ext = `.${(path.split('.').pop() ?? 'png').toLowerCase()}`
  return ext.startsWith('.') ? ext : `.${ext}`
}

async function bytesForImageAsset(
  projectRoot: string,
  asset: ImageAsset,
): Promise<Uint8Array | null> {
  if (asset.dataUrl) {
    try {
      const b64 = asset.dataUrl.split(',')[1] ?? ''
      const bin = atob(b64)
      const u8 = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      return u8.length > 0 ? u8 : null
    } catch {
      return null
    }
  }
  return readProjectFileBytes(projectRoot, asset.path)
}

/** Hot-reload a single image into the WASM texture cache (§7.2). */
export async function reloadProjectImageAsset(
  projectRoot: string,
  asset: ImageAsset,
): Promise<boolean> {
  const bytes = await bytesForImageAsset(projectRoot, asset)
  if (!bytes || bytes.length === 0) return false
  editorInvalidateAsset(asset.path, 'image')
  return editorRegisterImage(asset.path, bytes, extFromPath(asset.path))
}

/** Hot-reload a single audio file into the runtime sound cache. */
export async function reloadProjectAudioAsset(
  projectRoot: string,
  asset: AudioAsset,
): Promise<boolean> {
  const bytes = await readProjectFileBytes(projectRoot, asset.path)
  if (!bytes || bytes.length === 0) return false
  editorInvalidateAsset(asset.path, 'audio')
  return editorRegisterAudio(asset.path, bytes, extFromPath(asset.path))
}

export function imageRegisterKey(asset: ImageAsset): string {
  return registerKeyForDescriptor({
    id: asset.id,
    type: 'image',
    path: asset.path,
    dataUrl: asset.dataUrl,
  })
}
