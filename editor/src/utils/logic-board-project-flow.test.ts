import { describe, expect, it, vi } from 'vitest'
import { createBlankProject } from './project-factory'

const loadScript = vi.fn()
vi.mock('./api', () => ({
  loadScript: (...args: unknown[]) => loadScript(...args),
  resolveScriptPath: (projectPath: string, scriptPath: string) =>
    `${projectPath}/${scriptPath}`,
}))

const { openCombinedMainScript } = await import('./logic-board-project-flow')

describe('openCombinedMainScript', () => {
  it('opens Combined Preview without replacing an existing manual buffer', async () => {
    const project = createBlankProject()
    const actions: unknown[] = []
    const state = {
      project,
      projectPath: '/project/project.json',
      openScripts: [{ path: project.mainScriptPath, content: '-- manual', isDirty: true }],
    }
    expect(await openCombinedMainScript(
      (action) => actions.push(action),
      () => state as never,
    )).toBe(true)
    expect(loadScript).not.toHaveBeenCalled()
    expect(actions).toEqual([
      { type: 'SET_ACTIVE_SCRIPT', path: project.mainScriptPath },
      { type: 'SET_MODE', mode: 'script' },
      { type: 'SET_MAIN_SCRIPT_VIEW', view: 'combined' },
    ])
  })

  it('loads a missing manual buffer before opening Combined Preview', async () => {
    loadScript.mockResolvedValueOnce('-- manual from disk')
    const project = createBlankProject()
    const actions: unknown[] = []
    const state = { project, projectPath: '/project/project.json', openScripts: [] }
    expect(await openCombinedMainScript(
      (action) => actions.push(action),
      () => state as never,
    )).toBe(true)
    expect(actions[0]).toMatchObject({
      type: 'UPSERT_SCRIPT',
      path: project.mainScriptPath,
      content: '-- manual from disk',
      isDirty: false,
    })
  })

  it('does not overwrite a buffer opened while disk loading is in flight', async () => {
    const project = createBlankProject()
    let state = { project, projectPath: '/project/project.json', openScripts: [] as unknown[] }
    loadScript.mockImplementationOnce(async () => {
      state = {
        ...state,
        openScripts: [{
          path: project.mainScriptPath,
          content: '-- newer buffer',
          isDirty: true,
        }],
      }
      return '-- stale disk read'
    })
    const actions: unknown[] = []
    await openCombinedMainScript((action) => actions.push(action), () => state as never)
    expect(actions).not.toContainEqual(expect.objectContaining({ type: 'UPSERT_SCRIPT' }))
    expect(actions[0]).toEqual({ type: 'SET_ACTIVE_SCRIPT', path: project.mainScriptPath })
  })
})
