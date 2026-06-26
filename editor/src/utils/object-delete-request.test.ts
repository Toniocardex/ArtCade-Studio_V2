import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ProjectDoc } from '../types'
import type { Action } from '../store/editor-store-state'

const confirmDialogMock = vi.fn(async () => true)

vi.mock('./native-dialog', () => ({
  confirmDialog: (...args: unknown[]) => confirmDialogMock(...args),
  alertDialog: vi.fn(async () => undefined),
}))

import { requestDeleteObject } from './object-delete-request'

function sampleProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 'main',
    mainScriptPath: 'main.lua',
    entities: {
      1: { id: 1, name: 'Coin 1', class: 'coin', transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
    },
    objectTypes: {
      coin: { id: 'coin', displayName: 'Coin', tags: [], sprite: {} },
    },
    scenes: {
      main: {
        id: 'main',
        name: 'Main',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: [1],
        instances: [
          { id: 1, objectTypeId: 'coin', transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
        ],
      },
    },
  }
}

describe('requestDeleteObject', () => {
  beforeEach(() => {
    confirmDialogMock.mockReset()
    confirmDialogMock.mockResolvedValue(true)
  })

  it('dispatches ENTITY_DELETE when instance delete is confirmed', async () => {
    const dispatch = vi.fn<(action: Action) => void>()
    const project = sampleProject()

    await requestDeleteObject({
      dispatch,
      project,
      target: { kind: 'instance', entityId: 1 },
    })

    expect(confirmDialogMock).toHaveBeenCalledOnce()
    expect(dispatch).toHaveBeenCalledWith({ type: 'ENTITY_DELETE', entityId: 1 })
  })

  it('does not dispatch when instance delete is cancelled', async () => {
    confirmDialogMock.mockResolvedValue(false)
    const dispatch = vi.fn<(action: Action) => void>()

    await requestDeleteObject({
      dispatch,
      project: sampleProject(),
      target: { kind: 'instance', entityId: 1 },
    })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('shows destructive confirm and dispatches OBJECT_TYPE_DELETE when instances exist', async () => {
    const dispatch = vi.fn<(action: Action) => void>()

    await requestDeleteObject({
      dispatch,
      project: sampleProject(),
      target: { kind: 'object-type', objectTypeId: 'coin' },
    })

    expect(confirmDialogMock).toHaveBeenCalledOnce()
    expect(confirmDialogMock.mock.calls[0]?.[0]).toContain('all 1 instance')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'OBJECT_TYPE_DELETE',
      objectTypeId: 'coin',
    })
  })

  it('dispatches OBJECT_TYPE_DELETE when unused type delete is confirmed', async () => {
    const dispatch = vi.fn<(action: Action) => void>()
    const project = sampleProject()
    project.scenes.main.instances = []
    project.scenes.main.entityIds = []
    delete project.entities[1]

    await requestDeleteObject({
      dispatch,
      project,
      target: { kind: 'object-type', objectTypeId: 'coin' },
    })

    expect(confirmDialogMock).toHaveBeenCalledOnce()
    expect(dispatch).toHaveBeenCalledWith({
      type: 'OBJECT_TYPE_DELETE',
      objectTypeId: 'coin',
    })
  })

  it('does not dispatch when object type delete is cancelled', async () => {
    confirmDialogMock.mockResolvedValue(false)
    const dispatch = vi.fn<(action: Action) => void>()
    const project = sampleProject()
    project.scenes.main.instances = []
    project.scenes.main.entityIds = []

    await requestDeleteObject({
      dispatch,
      project,
      target: { kind: 'object-type', objectTypeId: 'coin' },
    })

    expect(dispatch).not.toHaveBeenCalled()
  })
})
