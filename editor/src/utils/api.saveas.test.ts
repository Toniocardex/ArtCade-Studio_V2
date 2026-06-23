// ---------------------------------------------------------------------------
// api.saveas.test — Save Project As… disk scaffold
// ---------------------------------------------------------------------------
//
// The flow we want to keep working forever:
//   1. saveProjectAsDialog() asks the user for a parent folder.
//   2. scaffoldNewProjectOnDisk() creates <parent>/<safeProjectName>/ and
//      writes BOTH the starter script and project.json, committing the
//      metadata only after every referenced file is durable.
//   3. The ProjectDoc passed in survives validation (no exception) and
//      reaches `write_file` as the same JSON parseProjectDoc emits.
//
// We mock @tauri-apps/api/core and plugin-dialog so the test does not need a
// running Tauri shell.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Tauri mocks (must run before importing api.ts) ------------------------

const invokeMock = vi.fn(async (_cmd: string, _args: unknown) => undefined)
const dialogSaveMock = vi.fn(
  async (_opts: { defaultPath?: string }): Promise<string | null> => null,
)
const dialogOpenMock = vi.fn(async (_opts?: unknown): Promise<string | null> => null)
const readTextFileMock = vi.fn(async () => '{}')
const readFileMock = vi.fn(async () => new Uint8Array())

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args: unknown) => invokeMock(cmd, args),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (opts: { defaultPath?: string }) => dialogSaveMock(opts),
  open: (opts?: unknown) => dialogOpenMock(opts),
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: () => readTextFileMock(),
  readFile: () => readFileMock(),
  writeFile: vi.fn(async () => undefined),
  mkdir:     vi.fn(async () => undefined),
  readDir:   vi.fn(async () => []),
  exists:    vi.fn(async () => false),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  openProjectDialog,
  saveProjectAsDialog,
  scaffoldNewProjectOnDisk,
  importAssetFile,
} = await import('./api')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createBlankProject, BLANK_MAIN_LUA, parseProjectDoc } = await import('./project')
const { clearPendingAssets, pendingAssetCount } = await import('./pending-asset-store')

describe('saveProjectAsDialog', () => {
  beforeEach(() => {
    invokeMock.mockClear()
    clearPendingAssets()
    dialogSaveMock.mockClear()
    dialogOpenMock.mockClear()
  })

  it('returns null when the user cancels', async () => {
    dialogOpenMock.mockResolvedValueOnce(null)
    const result = await saveProjectAsDialog()
    expect(result).toBeNull()
  })

  it('returns the chosen parent directory unchanged', async () => {
    dialogOpenMock.mockResolvedValueOnce('/tmp/games')
    const result = await saveProjectAsDialog('My Game')
    expect(result).toBe('/tmp/games')
  })

  it('opens a directory picker titled with the safe project name', async () => {
    dialogOpenMock.mockResolvedValueOnce(null)
    await saveProjectAsDialog('Bad:/Name')
    expect(dialogOpenMock).toHaveBeenCalledTimes(1)
    const opts = dialogOpenMock.mock.calls[0][0] as {
      directory?: boolean
      multiple?: boolean
      title?: string
      defaultPath?: string
    }
    expect(opts.directory).toBe(true)
    expect(opts.multiple).toBe(false)
    expect(opts.title).toContain('Bad__Name')
    expect(opts.title).toContain('parent folder')
  })

  it('forwards defaultPath to the directory picker', async () => {
    dialogOpenMock.mockResolvedValueOnce('/tmp/games')
    await saveProjectAsDialog('My Game', { defaultPath: 'C:/Users/Test' })
    const opts = dialogOpenMock.mock.calls[0][0] as { defaultPath?: string }
    expect(opts.defaultPath).toBe('C:/Users/Test')
  })
})

describe('openProjectDialog', () => {
  beforeEach(() => {
    dialogOpenMock.mockClear()
  })

  it('allows opening both project.json and .artcade packages', async () => {
    dialogOpenMock.mockResolvedValueOnce(null)
    await openProjectDialog()

    const opts = dialogOpenMock.mock.calls[0][0] as {
      filters?: Array<{ name: string; extensions: string[] }>
    }
    expect(opts.filters?.[0].extensions).toEqual(['json', 'artcade'])
  })
})

describe('scaffoldNewProjectOnDisk', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(undefined)
    clearPendingAssets()
  })

  it('writes project.json AND the starter Lua script next to it', async () => {
    const project = createBlankProject('Scaffold Test')
    const target  = '/tmp/games'

    await scaffoldNewProjectOnDisk(target, project, BLANK_MAIN_LUA)

    expect(invokeMock).toHaveBeenCalledTimes(3)

    // 1st write - main.lua at <projectRoot>/<mainScriptPath>, slash-normalised.
    const [cmd0, args0] = invokeMock.mock.calls[0] as [
      string,
      { path: string; content: string; projectRoot: string },
    ]
    expect(cmd0).toBe('write_file')
    expect(args0.path).toBe('/tmp/games/Scaffold Test/scripts/main.lua')
    expect(args0.projectRoot).toBe('/tmp/games/Scaffold Test')
    expect(args0.content).toBe(BLANK_MAIN_LUA)

    // 2nd write - project.json is the final durable commit point.
    const [cmd1, args1] = invokeMock.mock.calls[1] as [
      string,
      { path: string; content: string; projectRoot: string },
    ]
    expect(cmd1).toBe('write_file')
    expect(args1.path).toBe('/tmp/games/Scaffold Test/project.json')
    expect(args1.projectRoot).toBe('/tmp/games/Scaffold Test')
    const round = parseProjectDoc(args1.content)
    expect(round).not.toBeNull()
    expect(round!.projectName).toBe('Scaffold Test')

    expect(invokeMock.mock.calls[2]).toEqual([
      'register_project_fs_scope',
      { projectPath: '/tmp/games/Scaffold Test/project.json' },
    ])
  })

  it('flushes pending imported bytes before writing project metadata', async () => {
    const project = createBlankProject('Pending Assets')
    project.audioAssets = {
      aud_theme: {
        id: 'aud_theme', name: 'theme.ogg',
        path: 'assets/audio/aud_theme_theme.ogg',
      },
    }
    await importAssetFile({
      kind: 'audio', id: 'aud_theme', fileName: 'theme.ogg',
      bytes: new Uint8Array([7, 8, 9]),
    })
    await importAssetFile({
      kind: 'image', id: 'img_removed', fileName: 'removed.png',
      bytes: new Uint8Array([1]),
    })

    await scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA)

    expect(invokeMock.mock.calls[0]).toEqual([
      'write_binary_file',
      {
        path: '/tmp/games/Pending Assets/assets/audio/aud_theme_theme.ogg',
        bytes: [7, 8, 9],
        projectRoot: '/tmp/games/Pending Assets',
      },
    ])
    expect(invokeMock.mock.calls[1][1]).toMatchObject({
      path: '/tmp/games/Pending Assets/scripts/main.lua',
    })
    expect(invokeMock.mock.calls[2][1]).toMatchObject({
      path: '/tmp/games/Pending Assets/project.json',
    })
    expect(invokeMock.mock.calls.filter(([cmd]) => cmd === 'write_binary_file')).toHaveLength(1)
    expect(pendingAssetCount()).toBe(0)
  })

  it('recovers image bytes from dataUrl when the pending store was cleared', async () => {
    // Reproduces the lost-texture bug: bytes are imported, then the transient
    // pending store is wiped (e.g. a LOAD_PROJECT) before the disk-writing save.
    // project.json still references the file, so the in-memory dataUrl must be
    // written as a safety net instead of leaving a dangling path.
    const project = createBlankProject('DataUrl Recovery')
    project.assets = {
      img_hero: {
        id: 'img_hero', name: 'hero.png', usage: 'sprite',
        path: 'assets/images/img_hero_hero.png',
        dataUrl: 'data:image/png;base64,AQID', // bytes [1, 2, 3]
      },
    }
    // No importAssetFile() call → pending store is empty for this path.

    await scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA)

    const binaryWrites = invokeMock.mock.calls.filter(([cmd]) => cmd === 'write_binary_file')
    expect(binaryWrites).toHaveLength(1)
    expect(binaryWrites[0][1]).toEqual({
      path: '/tmp/games/DataUrl Recovery/assets/images/img_hero_hero.png',
      bytes: [1, 2, 3],
      projectRoot: '/tmp/games/DataUrl Recovery',
    })
  })

  it('does not double-write an image already flushed from the pending store', async () => {
    const project = createBlankProject('No Double Write')
    project.assets = {
      img_hero: {
        id: 'img_hero', name: 'hero.png', usage: 'sprite',
        path: 'assets/images/img_hero_hero.png',
        dataUrl: 'data:image/png;base64,AQID',
      },
    }
    await importAssetFile({
      kind: 'image', id: 'img_hero', fileName: 'hero.png',
      bytes: new Uint8Array([9, 9, 9]),
    })

    await scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA)

    const binaryWrites = invokeMock.mock.calls.filter(([cmd]) => cmd === 'write_binary_file')
    // Pending flush wins; the dataUrl fallback must not add a second write.
    expect(binaryWrites).toHaveLength(1)
    expect(binaryWrites[0][1]).toMatchObject({ bytes: [9, 9, 9] })
  })

  it('flushes pending tileset sheets referenced by project.tilesets', async () => {
    const project = createBlankProject('Tileset Flush')
    project.tilesets = {
      ts_grass: {
        assetId: 'ts_grass', name: 'grass', spriteImagePath: 'assets/tilesets/ts_grass_grass.png',
        tileSize: 16, margin: 0, cols: 4, rows: 4,
      },
    }
    await importAssetFile({
      kind: 'tileset', id: 'ts_grass', fileName: 'grass.png',
      bytes: new Uint8Array([4, 5, 6]),
    })

    await scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA)

    const binaryWrites = invokeMock.mock.calls.filter(([cmd]) => cmd === 'write_binary_file')
    expect(binaryWrites).toHaveLength(1)
    expect(binaryWrites[0][1]).toEqual({
      path: '/tmp/games/Tileset Flush/assets/tilesets/ts_grass_grass.png',
      bytes: [4, 5, 6],
      projectRoot: '/tmp/games/Tileset Flush',
    })
  })

  it('fails loudly instead of saving a project that references missing bytes', async () => {
    // Asset is referenced but has no staged bytes, no dataUrl, and exists()
    // is mocked false → the save must abort before writing project.json.
    const project = createBlankProject('Dangling Ref')
    project.assets = {
      img_gone: {
        id: 'img_gone', name: 'gone.png', usage: 'sprite',
        path: 'assets/images/img_gone_gone.png',
      },
    }

    await expect(
      scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA),
    ).rejects.toThrow(/Cannot save/i)

    // project.json was never written — no dangling reference on disk.
    expect(invokeMock.mock.calls.some(([cmd, args]) =>
      cmd === 'write_file' &&
      (args as { path: string }).path.endsWith('project.json'),
    )).toBe(false)
  })

  it('retains pending bytes when project metadata cannot be saved', async () => {
    const project = createBlankProject('Retry Save')
    project.assets = {
      img_retry: {
        id: 'img_retry', name: 'hero.png',
        path: 'assets/images/img_retry_hero.png',
      },
    }
    await importAssetFile({
      kind: 'image', id: 'img_retry', fileName: 'hero.png',
      bytes: new Uint8Array([1, 2, 3]),
    })
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'write_file') throw new Error('project write failed')
    })

    await expect(
      scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA),
    ).rejects.toThrow('project write failed')
    expect(pendingAssetCount()).toBe(1)
  })

  it('sanitises the project folder name', async () => {
    const project = createBlankProject('Bad:/Name')

    const savedPath = await scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA)

    expect(savedPath).toBe('/tmp/games/Bad__Name/project.json')
    const [, args1] = invokeMock.mock.calls[1] as [string, { path: string }]
    expect(args1.path).toBe('/tmp/games/Bad__Name/project.json')
  })

  it('normalises Windows-style backslashes in the derived script path', async () => {
    const project = createBlankProject('Win Test')
    const target  = 'C:\\Users\\Foo\\Desktop'

    await scaffoldNewProjectOnDisk(target, project, BLANK_MAIN_LUA)

    const [, args1] = invokeMock.mock.calls[0] as [string, { path: string }]
    // Backslashes from the project root get normalised; the join uses '/'.
    expect(args1.path).toBe('C:/Users/Foo/Desktop/Win Test/scripts/main.lua')
  })

  it('throws (and does NOT write) when the project fails logic-board validation', async () => {
    const project = createBlankProject('Bad')
    // validateProjectBeforeSave calls assertLogicBoardsValid — feeding a
    // malformed board entry must abort the scaffold before any disk write.
    project.logicBoards = [
      // Missing every required field on purpose.
      { not_a_board: true } as unknown as never,
    ]

    await expect(
      scaffoldNewProjectOnDisk('/tmp/x', project, BLANK_MAIN_LUA),
    ).rejects.toThrow()

    expect(invokeMock).not.toHaveBeenCalled()
  })
})
