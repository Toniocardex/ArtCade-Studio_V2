// ---------------------------------------------------------------------------
// artcade-zip-io - bounded ZIP central-directory read + verified inflate
// Used by artcade-package (Tauri import) and artcade-zip-parse (tests/headless).
// ---------------------------------------------------------------------------

export interface ZipEntry {
  path: string
  method: number
  flags: number
  crc32: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

const ZIP_EOCD = 0x06054b50
const ZIP_CENTRAL_FILE = 0x02014b50
const ZIP_LOCAL_FILE = 0x04034b50
const MAX_ENTRY_COUNT = 10_000
const MAX_ENTRY_BYTES = 256 * 1024 * 1024
const MAX_TOTAL_BYTES = 512 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 1_000
const COMPRESSION_RATIO_ALLOWANCE = 1024 * 1024
const textDecoder = new TextDecoder('utf-8', { fatal: true })

function requireRange(total: number, offset: number, length: number, label: string): void {
  if (offset < 0 || length < 0 || offset > total - length) {
    throw new Error(`invalid ZIP: truncated ${label}`)
  }
}

export function normalizeZipEntryPath(path: string): string {
  const slashPath = path.replace(/\\/g, '/')
  const isDirectory = slashPath.endsWith('/')
  const value = isDirectory ? slashPath.slice(0, -1) : slashPath
  if (!value || value.startsWith('/') || /^[a-zA-Z]:\//.test(value)) {
    throw new Error(`invalid ZIP entry path: ${path}`)
  }
  const parts = value.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`invalid ZIP entry path: ${path}`)
  }
  const normalized = parts.join('/')
  return isDirectory ? `${normalized}/` : normalized
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const minEocd = 22
  if (bytes.length < minEocd) {
    throw new Error('invalid ZIP: end of central directory not found')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const searchStart = Math.max(0, bytes.length - minEocd - 0xffff)
  let eocd = -1

  for (let i = bytes.length - minEocd; i >= searchStart; i--) {
    if (view.getUint32(i, true) === ZIP_EOCD) {
      const commentLength = view.getUint16(i + 20, true)
      if (i + minEocd + commentLength === bytes.length) {
        eocd = i
        break
      }
    }
  }
  if (eocd < 0) throw new Error('invalid ZIP: end of central directory not found')

  const diskNumber = view.getUint16(eocd + 4, true)
  const centralDisk = view.getUint16(eocd + 6, true)
  const diskEntryCount = view.getUint16(eocd + 8, true)
  const entryCount = view.getUint16(eocd + 10, true)
  const centralSize = view.getUint32(eocd + 12, true)
  const centralOffset = view.getUint32(eocd + 16, true)
  if (diskNumber !== 0 || centralDisk !== 0 || diskEntryCount !== entryCount) {
    throw new Error('unsupported ZIP: multi-disk archives are not supported')
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('unsupported ZIP: ZIP64 archives are not supported')
  }
  if (entryCount > MAX_ENTRY_COUNT) {
    throw new Error(`ZIP contains too many entries (${entryCount}; max ${MAX_ENTRY_COUNT})`)
  }
  requireRange(bytes.length, centralOffset, centralSize, 'central directory')
  if (centralOffset + centralSize > eocd) {
    throw new Error('invalid ZIP: central directory overlaps end record')
  }

  const entries: ZipEntry[] = []
  const paths = new Set<string>()
  let offset = centralOffset
  let totalUncompressed = 0

  for (let i = 0; i < entryCount; i++) {
    requireRange(bytes.length, offset, 46, 'central directory entry')
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_FILE) {
      throw new Error('invalid ZIP: malformed central directory')
    }

    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const expectedCrc32 = view.getUint32(offset + 16, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const entryLength = 46 + nameLen + extraLen + commentLen
    requireRange(bytes.length, offset, entryLength, 'central directory entry')

    if ((flags & 0x1) !== 0) throw new Error('unsupported ZIP: encrypted entries are not supported')
    if (method !== 0 && method !== 8) {
      throw new Error(`unsupported ZIP compression method ${method}`)
    }
    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new Error(`ZIP entry exceeds ${MAX_ENTRY_BYTES} bytes`)
    }
    if (
      uncompressedSize > compressedSize * MAX_COMPRESSION_RATIO + COMPRESSION_RATIO_ALLOWANCE
    ) {
      throw new Error('ZIP entry has an unsafe compression ratio')
    }
    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_TOTAL_BYTES) {
      throw new Error(`ZIP expands beyond ${MAX_TOTAL_BYTES} bytes`)
    }

    const nameStart = offset + 46
    const path = normalizeZipEntryPath(textDecoder.decode(bytes.subarray(nameStart, nameStart + nameLen)))
    if (paths.has(path)) throw new Error(`duplicate ZIP entry: ${path}`)
    paths.add(path)
    requireRange(bytes.length, localHeaderOffset, 30, `local header for ${path}`)

    entries.push({
      path,
      method,
      flags,
      crc32: expectedCrc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    })
    offset += entryLength
  }

  if (offset !== centralOffset + centralSize) {
    throw new Error('invalid ZIP: central directory size mismatch')
  }
  return entries
}

async function readInflatedBytes(
  stream: ReadableStream<Uint8Array>,
  expectedSize: number,
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > expectedSize || total > MAX_ENTRY_BYTES) {
        await reader.cancel('inflated ZIP entry exceeded declared size')
        throw new Error('invalid ZIP: inflated entry exceeds declared size')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (total !== expectedSize) {
    throw new Error(`invalid ZIP: inflated size mismatch (expected ${expectedSize}, got ${total})`)
  }
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

export async function inflateZipEntry(zipBytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength)
  const offset = entry.localHeaderOffset
  requireRange(zipBytes.length, offset, 30, `local header for ${entry.path}`)
  if (view.getUint32(offset, true) !== ZIP_LOCAL_FILE) {
    throw new Error(`invalid ZIP: malformed local header for ${entry.path}`)
  }

  const localFlags = view.getUint16(offset + 6, true)
  const localMethod = view.getUint16(offset + 8, true)
  const nameLen = view.getUint16(offset + 26, true)
  const extraLen = view.getUint16(offset + 28, true)
  const nameStart = offset + 30
  requireRange(zipBytes.length, nameStart, nameLen + extraLen, `local metadata for ${entry.path}`)
  const localPath = normalizeZipEntryPath(
    textDecoder.decode(zipBytes.subarray(nameStart, nameStart + nameLen)),
  )
  if (localPath !== entry.path || localMethod !== entry.method || localFlags !== entry.flags) {
    throw new Error(`invalid ZIP: local header does not match central entry for ${entry.path}`)
  }

  const dataStart = nameStart + nameLen + extraLen
  requireRange(zipBytes.length, dataStart, entry.compressedSize, `data for ${entry.path}`)
  const compressed = zipBytes.subarray(dataStart, dataStart + entry.compressedSize)
  let output: Uint8Array

  if (entry.method === 0) {
    if (entry.compressedSize !== entry.uncompressedSize) {
      throw new Error(`invalid ZIP: stored size mismatch for ${entry.path}`)
    }
    output = new Uint8Array(entry.uncompressedSize)
    output.set(compressed)
  } else {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream is not available in this environment')
    }
    const compressedCopy = new ArrayBuffer(compressed.byteLength)
    new Uint8Array(compressedCopy).set(compressed)
    const stream = new Blob([compressedCopy])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    output = await readInflatedBytes(stream, entry.uncompressedSize)
  }

  if (crc32(output) !== entry.crc32) {
    throw new Error(`invalid ZIP: CRC mismatch for ${entry.path}`)
  }
  return output
}

export async function decodeZipEntryUtf8(
  zipBytes: Uint8Array,
  entry: ZipEntry,
): Promise<string> {
  return textDecoder.decode(await inflateZipEntry(zipBytes, entry))
}
