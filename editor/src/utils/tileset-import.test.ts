import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.fn(async () => undefined)

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args: unknown) => invokeMock(cmd, args),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: vi.fn() }))

const { buildTilesetFromImageFile } = await import('./tileset-import')

describe('buildTilesetFromImageFile', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(undefined)
  })

  it('imports under assets/tilesets and does not create an image asset', async () => {
    const file = new File([new Uint8Array([1])], 'cave.png', { type: 'image/png' })
    const { tileset, imported } = await buildTilesetFromImageFile({
      file,
      bytes: new Uint8Array([1]),
      naturalWidth: 64,
      naturalHeight: 32,
      previewDataUrl: 'data:image/png;base64,AA==',
      projectRoot: '/project',
    })

    expect(imported.path).toMatch(/^assets\/tilesets\//)
    expect(tileset.spriteImagePath).toBe(imported.path)
    expect(tileset.previewDataUrl).toBe('data:image/png;base64,AA==')
    expect(tileset.cols).toBe(2)
    expect(tileset.rows).toBe(1)
  })
})
