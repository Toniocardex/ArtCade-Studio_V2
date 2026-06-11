import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import { buildArtcadeZipBytes } from './export-artcade-package'
import { inflateZipEntry, parseZipEntries } from './artcade-zip-io'

function centralDirectoryOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return view.getUint32(i + 16, true)
  }
  throw new Error('EOCD not found')
}

describe('artcade-zip-io', () => {
  it('parseZipEntries rejects non-ZIP bytes', () => {
    expect(() => parseZipEntries(new Uint8Array([0, 1, 2]))).toThrow(
      /end of central directory not found/,
    )
  })

  it('rejects duplicate normalized entry paths', async () => {
    const zip = await buildArtcadeZipBytes(createBlankProject(), {
      abcdefghijkl: new Uint8Array([1]),
    })
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    const firstCentral = centralDirectoryOffset(zip)
    const firstNameLength = view.getUint16(firstCentral + 28, true)
    const firstExtraLength = view.getUint16(firstCentral + 30, true)
    const firstCommentLength = view.getUint16(firstCentral + 32, true)
    const secondCentral = firstCentral + 46 + firstNameLength + firstExtraLength + firstCommentLength
    zip.set(new TextEncoder().encode('project.json'), secondCentral + 46)

    expect(() => parseZipEntries(zip)).toThrow(/duplicate ZIP entry: project\.json/)
  })

  it('rejects entries whose declared expansion exceeds the per-entry limit', async () => {
    const zip = await buildArtcadeZipBytes(createBlankProject())
    const central = centralDirectoryOffset(zip)
    new DataView(zip.buffer, zip.byteOffset, zip.byteLength).setUint32(
      central + 24,
      256 * 1024 * 1024 + 1,
      true,
    )

    expect(() => parseZipEntries(zip)).toThrow(/entry exceeds/)
  })

  it('verifies entry CRC before returning inflated bytes', async () => {
    const zip = await buildArtcadeZipBytes(createBlankProject())
    const entry = parseZipEntries(zip)[0]

    await expect(inflateZipEntry(zip, { ...entry, crc32: entry.crc32 ^ 1 })).rejects.toThrow(
      /CRC mismatch/,
    )
  })

  it('rejects a local header path that differs from the central directory', async () => {
    const zip = await buildArtcadeZipBytes(createBlankProject())
    const entry = parseZipEntries(zip)[0]
    zip[entry.localHeaderOffset + 30] = 'x'.charCodeAt(0)

    await expect(inflateZipEntry(zip, entry)).rejects.toThrow(/local header does not match/)
  })
})
