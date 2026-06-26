import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { EntityDef } from '../types'

const { syncEntityTransform, noteTransform } = vi.hoisted(() => ({
  syncEntityTransform: vi.fn(() => true),
  noteTransform: vi.fn(),
}))

vi.mock('./runtime-sync-service', () => ({
  runtimeSync: {
    syncEntityTransform,
    noteTransform,
  },
}))

import {
  commitEntityTransform,
  consumeRuntimeTransformEcho,
  transformSnapshotFromEntity,
} from './entity-transform-commit'

function sampleEntity(overrides: Partial<EntityDef['transform']> = {}): EntityDef {
  return {
    id: 1,
    name: 'Player',
    className: 'Player',
    tags: [],
    transform: {
      position: { x: 100, y: 200 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      ...overrides,
    },
    sprite: {
      spriteAssetId: null,
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    },
    visible: true,
  }
}

describe('entity-transform-commit', () => {
  beforeEach(() => {
    syncEntityTransform.mockClear()
    noteTransform.mockClear()
  })

  it('transformSnapshotFromEntity merges patch fields', () => {
    const entity = sampleEntity()
    expect(transformSnapshotFromEntity(entity, { x: 50 })).toEqual({
      entityId: 1,
      x: 50,
      y: 200,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    })
  })

  it('inspector commit dispatches and syncs to WASM', () => {
    const dispatch = vi.fn()
    const entity = sampleEntity()

    const committed = commitEntityTransform({
      dispatch,
      snapshot: transformSnapshotFromEntity(entity, { x: 105 }),
      source: 'inspector',
      snapToGrid: false,
      gridSize: 32,
    })

    expect(committed.x).toBe(105)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 105,
      y: 200,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    })
    expect(syncEntityTransform).toHaveBeenCalledWith(committed)
    expect(noteTransform).not.toHaveBeenCalled()
  })

  it('canvas commit notes transform when snap does not change position', () => {
    const dispatch = vi.fn()

    const committed = commitEntityTransform({
      dispatch,
      snapshot: {
        entityId: 1,
        x: 100,
        y: 200,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      source: 'canvas',
      snapToGrid: false,
      gridSize: 32,
    })

    expect(noteTransform).toHaveBeenCalledWith(committed)
    expect(syncEntityTransform).not.toHaveBeenCalled()
  })

  it('canvas commit syncs and records echo guard when snap corrects position', () => {
    const dispatch = vi.fn()
    const ignoreRuntimeEchoRef: { current: import('./runtime-sync-service').EntityTransformSnapshot | null } = {
      current: null,
    }

    const committed = commitEntityTransform({
      dispatch,
      snapshot: {
        entityId: 1,
        x: 813,
        y: 425,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      source: 'canvas',
      snapToGrid: true,
      gridSize: 32,
      ignoreRuntimeEchoRef,
    })

    expect(committed).toEqual({
      entityId: 1,
      x: 800,
      y: 416,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    })
    expect(syncEntityTransform).toHaveBeenCalledWith(committed)
    expect(noteTransform).not.toHaveBeenCalled()
    expect(ignoreRuntimeEchoRef.current).toEqual(committed)
  })

  it('skips dispatch and WASM when inspector commit is unchanged', () => {
    const dispatch = vi.fn()
    const entity = sampleEntity()

    const result = commitEntityTransform({
      dispatch,
      snapshot: transformSnapshotFromEntity(entity),
      source: 'inspector',
      snapToGrid: false,
      gridSize: 32,
      entity,
    })

    expect(result).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
    expect(syncEntityTransform).not.toHaveBeenCalled()
    expect(noteTransform).not.toHaveBeenCalled()
  })

  it('canvas snap correction ignores identical runtime echo', () => {
    const dispatch = vi.fn()
    const ignoreRuntimeEchoRef: { current: import('./runtime-sync-service').EntityTransformSnapshot | null } = {
      current: null,
    }

    const committed = commitEntityTransform({
      dispatch,
      snapshot: {
        entityId: 1,
        x: 813,
        y: 425,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      source: 'canvas',
      snapToGrid: true,
      gridSize: 32,
      ignoreRuntimeEchoRef,
    })

    expect(committed).not.toBeNull()
    dispatch.mockClear()
    syncEntityTransform.mockClear()

    expect(consumeRuntimeTransformEcho(ignoreRuntimeEchoRef, committed!)).toBe(true)
    expect(dispatch).not.toHaveBeenCalled()
    expect(syncEntityTransform).not.toHaveBeenCalled()
    expect(ignoreRuntimeEchoRef.current).toBeNull()
  })
})
