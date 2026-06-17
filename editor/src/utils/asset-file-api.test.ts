import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.fn(async () => undefined)

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args: unknown) => invokeMock(cmd, args),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: vi.fn() }))

const { importAssetFile, readProjectFileBytes } = await import('./asset-file-api')
const { clearPendingAssets, pendingAssetCount } = await import('./pending-asset-store')

describe('importAssetFile', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(undefined)
    clearPendingAssets()
  })

  it('writes tileset imports under assets/tilesets/', async () => {
    const imported = await importAssetFile({
      kind: 'tileset', id: 'ts_cave', fileName: 'cave_tileset.png',
      bytes: new Uint8Array([1]), projectRoot: '/project',
    })
    expect(imported.path).toBe('assets/tilesets/ts_cave_cave_tileset.png')
  })

  it('uses the stable id in the destination path to avoid filename collisions', async () => {
    const first = await importAssetFile({
      kind: 'image', id: 'img_one', fileName: 'hero.png',
      bytes: new Uint8Array([1]), projectRoot: '/project',
    })
    const second = await importAssetFile({
      kind: 'image', id: 'img_two', fileName: 'hero.png',
      bytes: new Uint8Array([2]), projectRoot: '/project',
    })

    expect(first.path).toBe('assets/images/img_one_hero.png')
    expect(second.path).toBe('assets/images/img_two_hero.png')
    expect(first.path).not.toBe(second.path)
  })

  it('stages raw bytes until an unsaved project gets a root directory', async () => {
    const imported = await importAssetFile({
      kind: 'audio', id: 'aud_pending', fileName: 'theme.ogg',
      bytes: new Uint8Array([4, 5, 6]),
    })

    expect(imported.persisted).toBe(false)
    expect(pendingAssetCount()).toBe(1)
    await expect(readProjectFileBytes('', imported.path)).resolves.toEqual(
      new Uint8Array([4, 5, 6]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('rejects a disk failure instead of returning a metadata-only asset', async () => {
    invokeMock.mockRejectedValueOnce(new Error('disk full'))
    await expect(importAssetFile({
      kind: 'font', id: 'font_fail', fileName: 'ui.ttf',
      bytes: new Uint8Array([1, 2]), projectRoot: '/project',
    })).rejects.toThrow('disk full')
    expect(pendingAssetCount()).toBe(0)
  })
})
