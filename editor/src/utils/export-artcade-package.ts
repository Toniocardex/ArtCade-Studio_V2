import { isTauri } from '@tauri-apps/api/core'
import { readFile, writeFile, mkdir } from '@tauri-apps/plugin-fs'
import type { ProjectDoc } from '../types'
import { serializeProjectDoc } from './project-codec'
import { collectReferencedProjectPaths } from './collect-referenced-project-paths'
import { joinPath, baseName } from './file-paths'
import { dirName } from './project'

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream is not available in this environment')
  }
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipWriteEntry {
  path: string
  data: Uint8Array
}

function buildZipStore(entries: ZipWriteEntry[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.path)
    const crc = crc32(entry.data)
    const local = new Uint8Array(30 + nameBytes.length + entry.data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(10, 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, entry.data.length, true)
    lv.setUint32(22, entry.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(entry.data, 30 + nameBytes.length)
    localParts.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, entry.data.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centralParts.push(central)
    offset += local.length
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const total =
    localParts.reduce((n, p) => n + p.length, 0) + centralSize + eocd.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of localParts) { out.set(p, pos); pos += p.length }
  for (const p of centralParts) { out.set(p, pos); pos += p.length }
  out.set(eocd, pos)
  return out
}

async function buildZipDeflate(entries: ZipWriteEntry[]): Promise<Uint8Array> {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.path)
    const compressed = await deflateRaw(entry.data)
    const crc = crc32(entry.data)
    const local = new Uint8Array(30 + nameBytes.length + compressed.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, 8, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, compressed.length, true)
    lv.setUint32(22, entry.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(compressed, 30 + nameBytes.length)
    localParts.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, 8, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, compressed.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centralParts.push(central)
    offset += local.length
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const total =
    localParts.reduce((n, p) => n + p.length, 0) + centralSize + eocd.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of localParts) { out.set(p, pos); pos += p.length }
  for (const p of centralParts) { out.set(p, pos); pos += p.length }
  out.set(eocd, pos)
  return out
}

export async function exportArtcadePackage(
  project: ProjectDoc,
  projectRoot: string,
  destPath: string,
): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const entries: ZipWriteEntry[] = []
    const checksums: Record<string, string> = {}
    const projectJson = serializeProjectDoc(project)
    const projectBytes = new TextEncoder().encode(projectJson)
    entries.push({ path: 'project.json', data: projectBytes })
    checksums['project.json'] = await sha256Hex(projectBytes)

    for (const rel of collectReferencedProjectPaths(project)) {
      const abs = joinPath(projectRoot, rel)
      const bytes = await readFile(abs)
      entries.push({ path: rel.replace(/\\/g, '/'), data: bytes })
      checksums[rel.replace(/\\/g, '/')] = await sha256Hex(bytes)
    }

    const manifest = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      checksums,
    }
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2))
    entries.push({ path: 'manifest.json', data: manifestBytes })

    const zip = entries.length > 3 ? await buildZipDeflate(entries) : buildZipStore(entries)
    await mkdir(dirName(destPath), { recursive: true })
    await writeFile(destPath, zip)
    console.info(`[export] Wrote ${destPath} (${baseName(destPath)})`)
    return true
  } catch (err) {
    console.error('[export] exportArtcadePackage failed:', err)
    return false
  }
}
