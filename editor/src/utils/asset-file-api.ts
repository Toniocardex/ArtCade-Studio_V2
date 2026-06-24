import { isTauri } from '@tauri-apps/api/core'
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { joinPath } from './file-paths'
import { normalizeProjectRelativePath } from './project-path-security'
import { invokeWriteBinaryFile } from './project-file-api'
import { readPendingAsset, stagePendingAsset } from './pending-asset-store'

export type ImportedAssetKind = 'image' | 'audio' | 'font' | 'tileset'

const ASSET_DIR: Record<ImportedAssetKind, string> = {
  image: 'assets/images',
  audio: 'assets/audio',
  font: 'assets/fonts',
  tileset: 'assets/tilesets',
}

const ASSET_PREFIX: Record<ImportedAssetKind, string> = {
  image: 'img',
  audio: 'aud',
  font: 'font',
  tileset: 'ts',
}

let fallbackIdSequence = 0

export function createAssetId(kind: ImportedAssetKind): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${ASSET_PREFIX[kind]}_${uuid.replace(/-/g, '')}`
  fallbackIdSequence++
  return `${ASSET_PREFIX[kind]}_${Date.now().toString(36)}_${fallbackIdSequence.toString(36)}`
}

export function safeAssetFileName(fileName: string): string {
  const base = fileName.replace(/\\/g, '/').split('/').pop() ?? ''
  if (!base || base === '.' || base === '..' || base.includes('..')) {
    throw new Error('Invalid asset file name.')
  }
  return base.replace(/[^A-Za-z0-9._-]/g, '_')
}

function notAvailable(name: string): void {
  console.warn(`[api] ${name}: Tauri not available in browser mode`)
}

/** Standalone ArrayBuffer for Blob/crypto (strict TS; Tauri may use SharedArrayBuffer views). */
export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Native file-picker for a spritesheet image. Returns the path or null. */
export async function openImageDialog(): Promise<string | null> {
  if (!isTauri()) { notAvailable('openImageDialog'); return null }

  const selected = await dialogOpen({
    title:    'Open Tileset Image',
    multiple: false,
    filters:  [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
  })
  return typeof selected === 'string' ? selected : null
}

/** Read an image from disk and return a base64 data URL for React preview. */
export async function readImageAsDataUrl(path: string): Promise<string | null> {
  if (!isTauri()) { notAvailable('readImageAsDataUrl'); return null }

  try {
    const bytes = await readFile(path)
    const ext = path.toLowerCase().split('.').pop() ?? 'png'
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : 'image/png'
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return `data:${mime};base64,${btoa(bin)}`
  } catch (err) {
    console.error('[api] readImageAsDataUrl failed:', err)
    return null
  }
}

export interface ImportAssetFileOptions {
  kind: ImportedAssetKind
  fileName: string
  bytes: Uint8Array
  projectRoot?: string | null
  id?: string
  rejectContentHashes?: ReadonlySet<string>
}

export interface ImportedAssetFile {
  id: string
  path: string
  persisted: boolean
  contentHash?: string
}

export class DuplicateAssetImportError extends Error {
  constructor(readonly contentHash: string) {
    super('This asset has already been imported.')
    this.name = 'DuplicateAssetImportError'
  }
}

export async function hashAssetBytes(bytes: Uint8Array): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return undefined
  const digest = await subtle.digest('SHA-256', bytesToArrayBuffer(bytes))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Single import path for every binary asset. Unsaved projects retain raw
 * bytes in memory; saved projects write the file before metadata is added.
 */
export async function importAssetFile(
  options: ImportAssetFileOptions,
): Promise<ImportedAssetFile> {
  if (options.bytes.length === 0) throw new Error('Cannot import an empty asset.')
  const contentHash = await hashAssetBytes(options.bytes)
  if (contentHash && options.rejectContentHashes?.has(contentHash)) {
    throw new DuplicateAssetImportError(contentHash)
  }
  const id = options.id ?? createAssetId(options.kind)
  const safeName = safeAssetFileName(options.fileName)
  const relPath = `${ASSET_DIR[options.kind]}/${id}_${safeName}`
  const projectRoot = options.projectRoot?.trim()

  if (projectRoot) {
    if (!isTauri()) throw new Error('Asset persistence requires the Tauri runtime.')
    await invokeWriteBinaryFile(joinPath(projectRoot, relPath), options.bytes, projectRoot)
    return { id, path: relPath, persisted: true, contentHash }
  }

  stagePendingAsset(relPath, options.bytes)
  return { id, path: relPath, persisted: false, contentHash }
}

export async function readProjectFileBytes(
  projectRoot: string,
  relPath: string,
): Promise<Uint8Array | null> {
  const pending = readPendingAsset(relPath)
  if (pending) return pending
  if (!isTauri()) return null
  try {
    const safeRel = normalizeProjectRelativePath(relPath, 'asset path')
    return await readFile(joinPath(projectRoot, safeRel))
  } catch {
    return null
  }
}

/** Read a project image (path relative to project root) as raw bytes. */
export async function readProjectImageBytes(
  projectRoot: string,
  relPath: string,
): Promise<Uint8Array | null> {
  if (!isTauri()) { notAvailable('readProjectImageBytes'); return null }
  try {
    const safeRel = normalizeProjectRelativePath(relPath, 'image path')
    return await readFile(joinPath(projectRoot, safeRel))
  } catch (err) {
    console.error('[api] readProjectImageBytes failed:', err)
    return null
  }
}
