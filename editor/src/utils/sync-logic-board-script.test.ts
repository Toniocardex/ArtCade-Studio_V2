import { describe, expect, it } from 'vitest'
import { coreReducer, type Action, type CoreState } from '../store/editor-store'
import {
  openMainScriptInEditor,
  resolveLogicScriptPath,
  syncLogicBoardToScript,
} from './sync-logic-board-script'

function minimalState(overrides: Partial<CoreState> = {}): CoreState {
  return {
    project: {
      name: 'test',
      version: '1',
      resolution: { x: 800, y: 600 },
      targetFPS: 60,
      activeSceneId: 's1',
      mainScriptPath: 'scripts/main.lua',
      scenes: {},
      logicBoards: [],
    },
    projectPath: null,
    projectDirty: false,
    selection: { entityId: null, sceneId: 's1' },
    mode: 'logic',
    consoleOpen: true,
    editingTilesetId: null,
    openScripts: [
      { path: 'scripts/entity.lua', content: '-- entity', isDirty: false },
    ],
    activeScriptPath: 'scripts/entity.lua',
    isPlaying: false,
    selectedTileCell: 1,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, editorZoomMode: 'manual', cameraPreview: false,
    projectLoadEpoch: 0,
    ...overrides,
  } as CoreState
}

describe('resolveLogicScriptPath', () => {
  it('returns mainScriptPath even when another script tab is active', () => {
    const state = minimalState()
    expect(resolveLogicScriptPath(state)).toBe('scripts/main.lua')
  })

  it('returns null when there is no project', () => {
    expect(resolveLogicScriptPath(minimalState({ project: null }))).toBeNull()
  })
})

describe('openMainScriptInEditor', () => {
  it('upserts main with activate, then switches to script mode', () => {
    const actions: Action[] = []
    expect(openMainScriptInEditor((a) => actions.push(a), minimalState(), '-- lb')).toBe(true)
    expect(actions).toEqual([
      {
        type: 'UPSERT_SCRIPT',
        path: 'scripts/main.lua',
        content: '-- lb',
        isDirty: false,
        activate: true,
      },
      { type: 'SET_MODE', mode: 'script' },
    ])
  })
})

describe('syncLogicBoardToScript', () => {
  it('dispatches UPSERT_SCRIPT on mainScriptPath with activate', () => {
    const actions: Action[] = []
    syncLogicBoardToScript((a) => actions.push(a), minimalState(), '-- generated')
    expect(actions).toEqual([
      {
        type: 'UPSERT_SCRIPT',
        path: 'scripts/main.lua',
        content: '-- generated',
        isDirty: false,
        activate: true,
      },
    ])
  })
})

describe('UPSERT_SCRIPT reducer', () => {
  it('adds main script without leaving logic mode', () => {
    const state = minimalState({ mode: 'logic', openScripts: [], activeScriptPath: null })
    const next = coreReducer(state, {
      type: 'UPSERT_SCRIPT',
      path: 'scripts/main.lua',
      content: '-- lb',
      isDirty: false,
      activate: true,
    })
    expect(next.mode).toBe('logic')
    expect(next.activeScriptPath).toBe('scripts/main.lua')
    expect(next.openScripts).toHaveLength(1)
    expect(next.openScripts[0].isDirty).toBe(false)
  })

  it('updates existing main script in place', () => {
    const state = minimalState({
      mode: 'logic',
      openScripts: [{ path: 'scripts/main.lua', content: 'old', isDirty: true }],
      activeScriptPath: 'scripts/main.lua',
    })
    const next = coreReducer(state, {
      type: 'UPSERT_SCRIPT',
      path: 'scripts/main.lua',
      content: 'new',
      isDirty: false,
      activate: true,
    })
    expect(next.openScripts[0].content).toBe('new')
    expect(next.openScripts[0].isDirty).toBe(false)
  })
})
