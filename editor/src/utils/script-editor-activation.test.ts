import { describe, it, expect, vi } from 'vitest'
import {
  applyScriptEditorActivation,
  resolveOpenScriptEditorPath,
  resolveScriptEditorTargetPath,
  resolveScriptEditorEmptyHint,
} from './script-editor-activation'
import type { CoreState } from '../store/editor-store-state'
import { initialCoreState } from '../store/editor-store-state'
import type { ProjectDoc } from '../types'

vi.mock('./open-project-script', () => ({
  openProjectScript: vi.fn(),
}))

import { openProjectScript } from './open-project-script'

function project(overrides: Partial<ProjectDoc> = {}): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'Hero',
        className: 'Player',
        tags: [],
        scriptPath: 'scripts/hero.lua',
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: {
          spriteAssetId: '',
          tint: { x: 1, y: 1, z: 1, w: 1 },
          fillColor: { x: 1, y: 1, z: 1 },
          alpha: 1,
          pivot: { x: 0.5, y: 0.5 },
          renderOrder: 0,
        },
      },
    },
    scenes: {},
    ...overrides,
  }
}

function state(overrides: Partial<CoreState> = {}): CoreState {
  return {
    ...initialCoreState,
    mode: 'script',
    project: project(),
    openScripts: [
      { path: 'scripts/main.lua', content: '-- main', isDirty: false },
      { path: 'scripts/hero.lua', content: '-- hero', isDirty: false },
    ],
    ...overrides,
  }
}

describe('script-editor-activation', () => {
  it('resolveOpenScriptEditorPath keeps a valid active tab', () => {
    const s = state({ activeScriptPath: 'scripts/hero.lua' })
    expect(resolveOpenScriptEditorPath(s)).toBe('scripts/hero.lua')
  })

  it('resolveOpenScriptEditorPath prefers entity script when preferSelection is set', () => {
    const s = state({
      activeScriptPath: 'scripts/main.lua',
      selection: { entityId: 1, sceneId: 's' },
    })
    expect(resolveOpenScriptEditorPath(s, { preferSelection: true })).toBe('scripts/hero.lua')
    expect(resolveOpenScriptEditorPath(s)).toBe('scripts/main.lua')
  })

  it('resolveOpenScriptEditorPath falls back to main.lua', () => {
    const s = state({
      activeScriptPath: null,
      selection: { entityId: null, sceneId: 's' },
    })
    expect(resolveOpenScriptEditorPath(s)).toBe('scripts/main.lua')
  })

  it('resolveScriptEditorTargetPath returns entity script before main', () => {
    const s = state({ selection: { entityId: 1, sceneId: 's' } })
    expect(resolveScriptEditorTargetPath(s)).toBe('scripts/hero.lua')
  })

  it('resolveScriptEditorTargetPath falls back to main when entity has no script', () => {
    const s = state({
      project: project({
        entities: {
          1: {
            ...project().entities[1]!,
            scriptPath: undefined,
          },
        },
      }),
      selection: { entityId: 1, sceneId: 's' },
    })
    expect(resolveScriptEditorTargetPath(s)).toBe('scripts/main.lua')
  })

  it('resolveScriptEditorEmptyHint avoids loading copy when the tab is already open', () => {
    expect(resolveScriptEditorEmptyHint({
      project: project(),
      projectPath: '/proj',
      selectionEntityId: null,
      openScriptPaths: ['scripts/main.lua'],
    })).toBe('Select a script tab above.')
  })

  it('resolveScriptEditorEmptyHint warns when project is unsaved on disk', () => {
    expect(resolveScriptEditorEmptyHint({
      project: project(),
      projectPath: null,
      selectionEntityId: null,
      openScriptPaths: [],
    })).toBe('Save the project to disk before editing scripts.')
  })

  it('applyScriptEditorActivation activates an open script without loading', () => {
    const dispatch = vi.fn()
    applyScriptEditorActivation(
      state({ activeScriptPath: null }),
      dispatch,
      { preferSelection: true },
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_ACTIVE_SCRIPT',
      path: 'scripts/main.lua',
    })
    expect(openProjectScript).not.toHaveBeenCalled()
  })

  it('applyScriptEditorActivation loads when the target tab is not open yet', () => {
    const dispatch = vi.fn()
    applyScriptEditorActivation(
      state({
        openScripts: [{ path: 'scripts/main.lua', content: '-- main', isDirty: false }],
        selection: { entityId: 1, sceneId: 's' },
      }),
      dispatch,
      { preferSelection: true },
    )
    expect(openProjectScript).toHaveBeenCalledWith(
      dispatch,
      expect.objectContaining({ projectPath: null }),
      'scripts/hero.lua',
      undefined,
    )
  })
})
