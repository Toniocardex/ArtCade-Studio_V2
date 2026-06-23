// ---------------------------------------------------------------------------
// artcade-package.import — encrypted package decrypts and reopens in editor
// ---------------------------------------------------------------------------
//
// Verifies the wiring added so the editor can reopen packages it produced:
// an encrypted container (ARTCADE1 magic) is routed through the Rust
// `decrypt_artcade_container` command, and the resulting plaintext ZIP is
// imported normally. The Rust side owns the real crypto (covered by its own
// unit tests); here we mock invoke to return the decrypted bytes.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn(async (_cmd: string, _args: unknown): Promise<unknown> => undefined)
const writtenFiles: string[] = []

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args: unknown) => invokeMock(cmd, args),
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(async () => readFileMock()),
  writeFile: vi.fn(async (path: string) => { writtenFiles.push(path) }),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
}))
vi.mock('./project-fs-scope', () => ({ registerProjectFsScope: vi.fn(async () => undefined) }))

let readFileMock: () => Uint8Array

const { importArtcadePackage } = await import('./artcade-package')
const { buildArtcadeZipBytes } = await import('./export-artcade-package')
const { createBlankProject } = await import('./project-factory')

const ENCRYPTED = new Uint8Array([...new TextEncoder().encode('ARTCADE1'), 1, 1, 9, 9, 9])

describe('importArtcadePackage (encrypted)', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    writtenFiles.length = 0
  })

  it('decrypts an editor-packed container and imports the project', async () => {
    const project = createBlankProject('Packed Game')
    const plainZip = await buildArtcadeZipBytes(project)

    // The on-disk file is the "encrypted" container; the Rust command returns
    // the decrypted plaintext ZIP.
    readFileMock = () => ENCRYPTED
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'decrypt_artcade_container') return Array.from(plainZip)
      return undefined
    })

    const loaded = await importArtcadePackage('/games/Packed Game.artcade')

    expect(invokeMock).toHaveBeenCalledWith(
      'decrypt_artcade_container',
      { bytes: Array.from(ENCRYPTED) },
    )
    expect(loaded).not.toBeNull()
    expect(loaded!.project.projectName).toBe('Packed Game')
    expect(writtenFiles.some((p) => p.endsWith('project.json'))).toBe(true)
  })

  it('returns null when decryption fails (wrong key)', async () => {
    readFileMock = () => ENCRYPTED
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'decrypt_artcade_container') throw new Error('wrong key')
      return undefined
    })

    const loaded = await importArtcadePackage('/games/locked.artcade')
    expect(loaded).toBeNull()
  })
})
