/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ConsolePanel from './ConsolePanel'
import { initialCoreState, type CoreState, type VolatileState } from '../store/editor-store-state'
import type { ProjectDoc } from '../types'

let mockState: CoreState = initialCoreState
let mockVolatileState: VolatileState = {
  consoleLogs: [],
  cursorPos: { x: 0, y: 0 },
}

vi.mock('../store/editor-store', () => ({
  useEditorDispatch: () => vi.fn(),
  useEditorSelector: (selector: (state: CoreState) => unknown) => selector(mockState),
  useConsoleLogs: () => ({ state: mockVolatileState, dispatch: vi.fn() }),
}))

function projectWithDiagnostics(): ProjectDoc {
  return {
    projectName: 'Console diagnostics',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 'missing-scene',
    mainScriptPath: '',
    logicBoards: [{
      boardId: 'global-rules',
      target: { type: 'global' },
      events: [],
    }],
    entities: {
      1: {
        id: 1,
        name: 'Hero',
        className: 'Hero',
        tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: {
          spriteAssetId: 'missing-image',
          tint: { x: 1, y: 1, z: 1, w: 1 },
          fillColor: { x: 1, y: 1, z: 1 },
          alpha: 1,
          pivot: { x: 0.5, y: 0.5 },
          renderOrder: 0,
        },
        visible: true,
      },
    },
    scenes: {
      main: {
        id: 'main',
        name: 'Main',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1, 99],
      },
    },
    assets: {},
  }
}

describe('ConsolePanel', () => {
  afterEach(() => {
    cleanup()
    globalThis.localStorage.clear()
    mockState = initialCoreState
    mockVolatileState = { consoleLogs: [], cursorPos: { x: 0, y: 0 } }
  })

  it('shows every project-health diagnostic together with runtime logs', () => {
    mockState = { ...initialCoreState, project: projectWithDiagnostics() }
    mockVolatileState = {
      cursorPos: { x: 0, y: 0 },
      consoleLogs: [{ id: 1, time: '12:00:00', level: 'error', message: 'Runtime failure.' }],
    }

    const { container } = render(<ConsolePanel compact />)
    const text = container.textContent ?? ''

    expect(text).toContain('activeSceneId "missing-scene" does not match any scene.')
    expect(text).toContain('references missing image asset "missing-image".')
    expect(text).toContain('lists missing entity id 99.')
    expect(text).toContain('[logic-compile]')
    expect(text).toContain('Logic boards exist but mainScriptPath is empty')
    expect(text).toContain('Runtime failure.')
    expect(screen.getByRole('button', { name: /Errors 5/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Warnings 1/ })).toBeTruthy()
  })
})
