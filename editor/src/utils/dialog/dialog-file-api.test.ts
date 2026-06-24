import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveDialogsToProject } from './dialog-file-api'
import { emptyDialogScript } from './dialog-script'

const fsState = vi.hoisted(() => ({
  entries: [] as { name: string; isFile: boolean }[],
  exists: true,
}))

const writeFileMock = vi.hoisted(() => vi.fn())
const deleteFileMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => fsState.exists),
  readDir: vi.fn(async () => fsState.entries),
  readTextFile: vi.fn(),
}))

vi.mock('../project-file-api', () => ({
  invokeWriteFile: writeFileMock,
  invokeDeleteProjectFile: deleteFileMock,
}))

describe('saveDialogsToProject', () => {
  beforeEach(() => {
    fsState.exists = true
    fsState.entries = []
    writeFileMock.mockReset()
    deleteFileMock.mockReset()
  })

  it('removes stale dialogs json files before writing the current library', async () => {
    fsState.entries = [
      { name: 'old_dialog.json', isFile: true },
      { name: 'innkeeper.json', isFile: true },
      { name: 'notes.txt', isFile: true },
      { name: 'nested.json', isFile: false },
    ]

    await saveDialogsToProject('C:/game/project.json', {
      innkeeper: emptyDialogScript('innkeeper'),
    })

    expect(deleteFileMock).toHaveBeenCalledTimes(1)
    expect(deleteFileMock).toHaveBeenCalledWith('C:/game/dialogs/old_dialog.json', 'C:/game')
    expect(writeFileMock).toHaveBeenCalledWith(
      'C:/game/dialogs/innkeeper.json',
      expect.stringContaining('"dialogId": "innkeeper"'),
      'C:/game',
    )
  })
})
