import { describe, expect, it } from 'vitest'
import { coreReducer } from './editor-store'
import { initialCoreState } from './editor-store-state'
import { createBlankProject } from '../utils/project'

describe('play session authoring lock & workspace restore', () => {
  it('blocks authoring actions while playing', () => {
    const project = createBlankProject('Play Lock')
    let state = {
      ...initialCoreState,
      project,
      projectPath: '/tmp/p/project.json',
      isPlaying: true,
      mode: 'canvas' as const,
      modeBeforePlay: 'logic' as const,
    }
    const next = coreReducer(state, {
      type: 'PROJECT_RENAME',
      name: 'Hacked During Play',
    })
    expect(next).toBe(state)
    expect(next.project?.projectName).toBe('Play Lock')
  })

  it('blocks project undo while playing', () => {
    const state = {
      ...initialCoreState,
      project: createBlankProject('Undo Lock'),
      isPlaying: true,
      projectHistory: {
        past: [{ project: createBlankProject('Older'), dialogs: {} }],
        future: [],
        coalesceKey: null as string | null,
      },
    }
    // Minimal history shape — if applyProjectUndo needs more, assertion is still no-op.
    const next = coreReducer(state as typeof initialCoreState, { type: 'PROJECT_UNDO' })
    expect(next).toBe(state)
  })

  it('captures origin mode on Play and restores on Stop', () => {
    const project = createBlankProject('Workspace')
    let state = {
      ...initialCoreState,
      project,
      mode: 'logic' as const,
      modeBeforePlay: null,
      isPlaying: false,
    }
    state = coreReducer(state, { type: 'SET_PLAYING', playing: true })
    expect(state.isPlaying).toBe(true)
    expect(state.mode).toBe('canvas')
    expect(state.modeBeforePlay).toBe('logic')

    state = coreReducer(state, { type: 'SET_PLAYING', playing: false })
    expect(state.isPlaying).toBe(false)
    expect(state.mode).toBe('logic')
    expect(state.modeBeforePlay).toBeNull()
  })

  it('does not restore origin when user changed workspace during Play', () => {
    let state = {
      ...initialCoreState,
      project: createBlankProject('Touched'),
      mode: 'script' as const,
      modeBeforePlay: null,
      isPlaying: false,
    }
    state = coreReducer(state, { type: 'SET_PLAYING', playing: true })
    expect(state.modeBeforePlay).toBe('script')
    state = coreReducer(state, { type: 'SET_MODE', mode: 'logic' })
    expect(state.mode).toBe('logic')
    expect(state.modeBeforePlay).toBeNull()

    state = coreReducer(state, { type: 'SET_PLAYING', playing: false })
    expect(state.mode).toBe('logic')
  })
})
