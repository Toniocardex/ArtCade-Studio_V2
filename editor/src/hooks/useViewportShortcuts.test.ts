// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import type { CoreState } from '../store/editor-store'
import type { ProjectDoc } from '../types'
import {
  getCanvasClipboardShortcutAction,
  getCanvasDuplicateShortcutAction,
} from './useViewportShortcuts'

function project(): ProjectDoc {
  return {
    projectName: 'Shortcut',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 'scene_main',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      4: {
        id: 4,
        name: 'Coin',
        className: 'Coin',
        tags: [],
        transform: {
          position: { x: 10, y: 20 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
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
    objectTypes: {
      Coin: {
        id: 'Coin',
        displayName: 'Coin',
        tags: [],
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
    scenes: {
      scene_main: {
        id: 'scene_main',
        name: 'Main',
        worldSize: { x: 512, y: 320 },
        viewportSize: { x: 512, y: 320 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [4],
        instances: [{
          id: 4,
          objectTypeId: 'Coin',
          transform: {
            position: { x: 10, y: 20 },
            scale: { x: 1, y: 1 },
            rotation: 0,
          },
        }],
      },
    },
  }
}

function state(overrides: Partial<CoreState> = {}): CoreState {
  return {
    mode: 'canvas',
    isPlaying: false,
    project: project(),
    selection: { entityId: 4, sceneId: 'scene_main' },
    instanceClipboard: null,
    snapToGrid: false,
    editorGridSize: 32,
    ...overrides,
  } as CoreState
}

function duplicateEvent(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, ...init })
}

afterEach(() => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
})

describe('getCanvasDuplicateShortcutAction', () => {
  it('duplicates the selected scene instance with Ctrl+D or Cmd+D', () => {
    expect(getCanvasDuplicateShortcutAction(duplicateEvent(), state())).toEqual({
      type: 'INSTANCE_DUPLICATE',
      instanceId: 4,
      sceneId: 'scene_main',
    })
    expect(getCanvasDuplicateShortcutAction(
      duplicateEvent({ ctrlKey: false, metaKey: true }),
      state(),
    )).toEqual({
      type: 'INSTANCE_DUPLICATE',
      instanceId: 4,
      sceneId: 'scene_main',
    })
  })

  it('ignores the shortcut outside editable canvas state', () => {
    expect(getCanvasDuplicateShortcutAction(duplicateEvent(), state({ mode: 'logic' }))).toBeNull()
    expect(getCanvasDuplicateShortcutAction(duplicateEvent(), state({ isPlaying: true }))).toBeNull()
    expect(getCanvasDuplicateShortcutAction(
      duplicateEvent(),
      state({ selection: { entityId: null, sceneId: 'scene_main' } }),
    )).toBeNull()
  })

  it('ignores the shortcut while typing in a form control', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(getCanvasDuplicateShortcutAction(duplicateEvent(), state())).toBeNull()
    input.remove()
  })
})

describe('getCanvasClipboardShortcutAction', () => {
  it('copies the selected scene instance with Ctrl+C or Cmd+C', () => {
    expect(getCanvasClipboardShortcutAction(
      new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }),
      state(),
    )).toEqual({
      type: 'INSTANCE_COPY',
      instanceId: 4,
      sceneId: 'scene_main',
    })
    expect(getCanvasClipboardShortcutAction(
      new KeyboardEvent('keydown', { key: 'c', metaKey: true }),
      state(),
    )).toEqual({
      type: 'INSTANCE_COPY',
      instanceId: 4,
      sceneId: 'scene_main',
    })
  })

  it('pastes into the active scene when the clipboard belongs to that scene', () => {
    expect(getCanvasClipboardShortcutAction(
      new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }),
      state({
        instanceClipboard: {
          sceneId: 'scene_main',
          instance: {
            id: 4,
            objectTypeId: 'Coin',
            transform: {
              position: { x: 10, y: 20 },
              scale: { x: 1, y: 1 },
              rotation: 0,
            },
          },
        },
      }),
    )).toEqual({
      type: 'INSTANCE_PASTE',
      sceneId: 'scene_main',
      position: { x: 26, y: 36 },
    })
  })

  it('offsets paste by the grid size while snap-to-grid is active', () => {
    expect(getCanvasClipboardShortcutAction(
      new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }),
      state({
        snapToGrid: true,
        editorGridSize: 32,
        instanceClipboard: {
          sceneId: 'scene_main',
          instance: {
            id: 4,
            objectTypeId: 'Coin',
            transform: {
              position: { x: 10, y: 20 },
              scale: { x: 1, y: 1 },
              rotation: 0,
            },
          },
        },
      }),
    )).toEqual({
      type: 'INSTANCE_PASTE',
      sceneId: 'scene_main',
      position: { x: 42, y: 52 },
    })
  })

  it('ignores paste when the clipboard belongs to another scene', () => {
    expect(getCanvasClipboardShortcutAction(
      new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }),
      state({
        instanceClipboard: {
          sceneId: 'other_scene',
          instance: {
            id: 4,
            objectTypeId: 'Coin',
            transform: {
              position: { x: 10, y: 20 },
              scale: { x: 1, y: 1 },
              rotation: 0,
            },
          },
        },
      }),
    )).toBeNull()
  })
})
