// ---------------------------------------------------------------------------
// api.saveas.test — Save Project As… disk scaffold
// ---------------------------------------------------------------------------
//
// The flow we want to keep working forever:
//   1. saveProjectAsDialog() asks the user for a parent folder.
//   2. scaffoldNewProjectOnDisk() creates <parent>/<safeProjectName>/ and
//      writes BOTH project.json and the starter script at
//      <projectRoot>/<mainScriptPath>, in that order, via write_file.
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
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  saveProjectAsDialog,
  scaffoldNewProjectOnDisk,
} = await import('./api')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createBlankProject, BLANK_MAIN_LUA, parseProjectDoc } = await import('./project')

describe('saveProjectAsDialog', () => {
  beforeEach(() => {
    invokeMock.mockClear()
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
    const opts = dialogOpenMock.mock.calls[0][0] as { directory?: boolean; multiple?: boolean; title?: string }
    expect(opts.directory).toBe(true)
    expect(opts.multiple).toBe(false)
    expect(opts.title).toContain('Bad__Name')
  })
})

describe('scaffoldNewProjectOnDisk', () => {
  beforeEach(() => {
    invokeMock.mockClear()
  })

  it('writes project.json AND the starter Lua script next to it', async () => {
    const project = createBlankProject('Scaffold Test')
    const target  = '/tmp/games'

    await scaffoldNewProjectOnDisk(target, project, BLANK_MAIN_LUA)

    expect(invokeMock).toHaveBeenCalledTimes(2)

    // 1st write — project.json with normalised path & valid JSON content.
    const [cmd0, args0] = invokeMock.mock.calls[0] as [string, { path: string; content: string }]
    expect(cmd0).toBe('write_file')
    expect(args0.path).toBe('/tmp/games/Scaffold Test/project.json')
    // The serialised JSON must parse back into a valid project.
    const round = parseProjectDoc(args0.content)
    expect(round).not.toBeNull()
    expect(round!.projectName).toBe('Scaffold Test')

    // 2nd write — main.lua at <projectRoot>/<mainScriptPath>, slash-normalised.
    const [cmd1, args1] = invokeMock.mock.calls[1] as [string, { path: string; content: string }]
    expect(cmd1).toBe('write_file')
    expect(args1.path).toBe('/tmp/games/Scaffold Test/scripts/main.lua')
    expect(args1.content).toBe(BLANK_MAIN_LUA)
  })

  it('sanitises the project folder name', async () => {
    const project = createBlankProject('Bad:/Name')

    const savedPath = await scaffoldNewProjectOnDisk('/tmp/games', project, BLANK_MAIN_LUA)

    expect(savedPath).toBe('/tmp/games/Bad__Name/project.json')
    const [, args0] = invokeMock.mock.calls[0] as [string, { path: string }]
    expect(args0.path).toBe('/tmp/games/Bad__Name/project.json')
  })

  it('normalises Windows-style backslashes in the derived script path', async () => {
    const project = createBlankProject('Win Test')
    const target  = 'C:\\Users\\Foo\\Desktop'

    await scaffoldNewProjectOnDisk(target, project, BLANK_MAIN_LUA)

    const [, args1] = invokeMock.mock.calls[1] as [string, { path: string }]
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
