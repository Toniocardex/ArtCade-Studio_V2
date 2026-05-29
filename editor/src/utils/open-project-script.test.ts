import { describe, expect, it, vi, beforeEach } from 'vitest'
import { openProjectScript } from './open-project-script'

vi.mock('./api', () => ({
  loadScript: vi.fn(),
  resolveScriptPath: vi.fn((root: string, rel: string) => `${root}/${rel}`),
}))

import { loadScript } from './api'

describe('openProjectScript', () => {
  beforeEach(() => {
    vi.mocked(loadScript).mockReset()
  })

  it('switches to existing open tab without reloading from disk', async () => {
    const dispatch = vi.fn()
    await openProjectScript(
      dispatch,
      {
        projectPath: '/proj',
        openScripts: [{ path: 'scripts/main.lua', content: 'print(1)', isDirty: true }],
      },
      'scripts/main.lua',
    )
    expect(loadScript).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ACTIVE_SCRIPT', path: 'scripts/main.lua' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_MODE', mode: 'script' })
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'OPEN_SCRIPT' }))
  })

  it('loads from disk before OPEN_SCRIPT when tab is new', async () => {
    vi.mocked(loadScript).mockResolvedValue('local x = 1')
    const dispatch = vi.fn()
    await openProjectScript(
      dispatch,
      { projectPath: '/proj/MyGame', openScripts: [] },
      'scripts/player.lua',
    )
    expect(loadScript).toHaveBeenCalledWith('/proj/MyGame/scripts/player.lua')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'OPEN_SCRIPT',
      file: { path: 'scripts/player.lua', content: 'local x = 1', isDirty: false },
    })
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_MODE', mode: 'script' })
  })
})
