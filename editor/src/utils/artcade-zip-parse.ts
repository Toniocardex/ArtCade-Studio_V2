// ---------------------------------------------------------------------------
// artcade-zip-parse — read .artcade ZIP bytes (shared by import + tests)
// ---------------------------------------------------------------------------

import { parseProjectDoc } from './project-codec'
import type { ProjectDoc } from '../types'
import type { ProjectAssetManifest } from './build-project-asset-manifest'

interface ZipEntry {
  path: string
  method: number
  compressedSize: number
  localHeaderOffset: number
}

const ZIP_EOCD = 0x06054b50
const ZIP_CENTRAL_FILE = 0x02014b50
const ZIP_LOCAL_FILE = 0x04034b50
const textDecoder = new TextDecoder('utf-8')

function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minEocd = 22
  const maxComment = 0xffff
  const searchStart = Math.max(0, bytes.length - minEocd - maxComment)
  let eocd = -1

  for (let i = bytes.length - minEocd; i >= searchStart; i--) {
    if (view.getUint32(i, true) === ZIP_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('invalid ZIP: end of central directory not found')

  const entryCount = view.getUint16(eocd + 10, true)
  const centralOffset = view.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  let offset = centralOffset

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_FILE) {
      throw new Error('invalid ZIP: malformed central directory')
    }

    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nameStart = offset + 46
    const path = textDecoder.decode(bytes.subarray(nameStart, nameStart + nameLen))

    entries.push({ path: path.replace(/\\/g, '/'), method, compressedSize, localHeaderOffset })
    offset = nameStart + nameLen + extraLen + commentLen
  }

  return entries
}

async function inflateZipEntry(zipBytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength)
  const offset = entry.localHeaderOffset
  if (view.getUint32(offset, true) !== ZIP_LOCAL_FILE) {
    throw new Error(`invalid ZIP: malformed local header for ${entry.path}`)
  }

  const nameLen = view.getUint16(offset + 26, true)
  const extraLen = view.getUint16(offset + 28, true)
  const dataStart = offset + 30 + nameLen + extraLen
  const compressed = zipBytes.subarray(dataStart, dataStart + entry.compressedSize)

  if (entry.method === 0) return compressed
  if (entry.method !== 8) {
    throw new Error(`unsupported ZIP compression method ${entry.method} for ${entry.path}`)
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not available')
  }

  const compressedCopy = new ArrayBuffer(compressed.byteLength)
  new Uint8Array(compressedCopy).set(compressed)
  const stream = new Blob([compressedCopy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export type ParsedArtcadePackage = Readonly<{
  project: ProjectDoc
  manifest: ProjectAssetManifest | null
}>

/** Parse in-memory .artcade ZIP bytes (no filesystem). */
export async function parseArtcadePackageBytes(bytes: Uint8Array): Promise<ParsedArtcadePackage> {
  const entries = parseZipEntries(bytes)
  const projectEntry = entries.find((e) => e.path === 'project.json')
  if (!projectEntry) throw new Error('project.json not found inside package')

  const projectJson = textDecoder.decode(await inflateZipEntry(bytes, projectEntry))
  const project = parseProjectDoc(projectJson)
  if (!project) throw new Error('invalid project.json inside package')

  const manifestEntry = entries.find((e) => e.path === 'manifest.json')
  let manifest: ProjectAssetManifest | null = null
  if (manifestEntry) {
    const manifestJson = textDecoder.decode(await inflateZipEntry(bytes, manifestEntry))
    manifest = JSON.parse(manifestJson) as ProjectAssetManifest
  }

  return { project, manifest }
}
