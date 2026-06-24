import { describe, expect, it } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import type { ProjectDoc } from '../types'

function project(): ProjectDoc {
  return {
    projectName: 'Layers',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    layers: [{ name: 'Foreground' }],
    entities: {},
    scenes: {
      s: {
        id: 's',
        name: 'Scene',
        worldSize: { x: 320, y: 180 },
        viewportSize: { x: 320, y: 180 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [],
      },
    },
  }
}

function state(): CoreState {
  return {
    project: project(),
    projectDirty: false,
  } as CoreState
}

describe('layer reducer', () => {
  it('persists non-default visibility, lock, and opacity values', () => {
    const next = coreReducer(state(), {
      type: 'LAYER_UPDATE',
      name: 'Foreground',
      patch: { visible: false, locked: true, opacity: 0.4 },
    })

    expect(next.project?.layers?.[0]).toMatchObject({
      name: 'Foreground',
      visible: false,
      locked: true,
      opacity: 0.4,
    })
    expect(next.projectDirty).toBe(true)
  })

  it('drops default visibility, lock, and opacity values from the project model', () => {
    const hidden = coreReducer(state(), {
      type: 'LAYER_UPDATE',
      name: 'Foreground',
      patch: { visible: false, locked: true, opacity: 0.4 },
    })
    const restored = coreReducer(hidden, {
      type: 'LAYER_UPDATE',
      name: 'Foreground',
      patch: { visible: true, locked: false, opacity: 1 },
    })

    expect(restored.project?.layers?.[0]).toEqual({ name: 'Foreground' })
  })
})
