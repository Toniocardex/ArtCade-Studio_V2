import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBlankProject } from '../../utils/project'

const confirmMock = vi.fn(() => true)
vi.stubGlobal('confirm', confirmMock)

const saveProjectAsDialog = vi.fn()
const scaffoldNewProjectOnDisk = vi.fn()
const saveProjectFile = vi.fn()
const saveScript = vi.fn()
const copyProjectDataDirs = vi.fn()
const saveDialogsToProject = vi.fn()

vi.mock('../../utils/dialog/dialog-file-api', () => ({
  saveDialogsToProject: (...args: unknown[]) => saveDialogsToProject(...args),
  starterInnkeeperScript: () => ({ dialogId: 'innkeeper', commands: [{ type: 'end' }] }),
}))

vi.mock('../../utils/api', () => ({
  saveProjectAsDialog: (...args: unknown[]) => saveProjectAsDialog(...args),
  scaffoldNewProjectOnDisk: (...args: unknown[]) => scaffoldNewProjectOnDisk(...args),
  saveProjectFile: (...args: unknown[]) => saveProjectFile(...args),
  saveScript: (...args: unknown[]) => saveScript(...args),
  resolveScriptPath: (projectPath: string, scriptPath: string) =>
    `${projectPath.replace(/project\.json$/, '')}${scriptPath}`,
  copyProjectDataDirs: (...args: unknown[]) => copyProjectDataDirs(...args),
}))

const { ensureProjectOnDisk } = await import('./ensureProjectOnDisk')

describe('ensureProjectOnDisk', () => {
  const dispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    confirmMock.mockReturnValue(true)
    saveProjectFile.mockResolvedValue(undefined)
    saveScript.mockResolvedValue(undefined)
    copyProjectDataDirs.mockResolvedValue(undefined)
    saveDialogsToProject.mockResolvedValue(undefined)
  })

  it('prompts migration when on-disk folder name differs from project name', async () => {
    confirmMock.mockReturnValue(true)
    saveProjectAsDialog.mockResolvedValueOnce('/tmp/games')
    scaffoldNewProjectOnDisk.mockResolvedValueOnce('/tmp/games/MyGame/project.json')

    const project = createBlankProject('MyGame')
    const path = await ensureProjectOnDisk({
      kind: 'WASM',
      dispatch,
      project,
      projectPath: '/tmp/games/Untitled/project.json',
      dialogs: {},
    })

    expect(path).toBe('/tmp/games/MyGame/project.json')
    expect(saveProjectAsDialog).toHaveBeenCalledWith('MyGame', { defaultPath: '/tmp/games' })
    expect(copyProjectDataDirs).toHaveBeenCalledWith(
      '/tmp/games/Untitled',
      '/tmp/games/MyGame',
    )
  })

  it('cancels migration when the user declines', async () => {
    confirmMock.mockReturnValue(false)

    const project = createBlankProject('MyGame')
    const path = await ensureProjectOnDisk({
      kind: 'Build',
      dispatch,
      project,
      projectPath: '/tmp/games/Untitled/project.json',
      dialogs: {},
    })

    expect(path).toBeNull()
    expect(scaffoldNewProjectOnDisk).not.toHaveBeenCalled()
  })
})
