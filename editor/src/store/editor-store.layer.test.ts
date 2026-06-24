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
    layers: [{ id: 'lyr_fg', name: 'Foreground' }],
    entities: {},
    scenes: {
      s: {
        id: 's',
        name: 'Scene',
        worldSize: { x: 320, y: 180 },
        viewportSize: { x: 320, y: 180 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [],
        instances: [],
      },
    },
  }
}

function state(): CoreState {
  return {
    project: project(),
    projectDirty: false,
    editorActiveLayerId: 'lyr_fg',
    inspectorLayerId: null,
  } as CoreState
}

describe('layer reducer', () => {
  it('selects a newly added layer as the active authoring layer', () => {
    const next = coreReducer(state(), {
      type: 'LAYER_ADD',
      name: 'Gameplay',
    })

    const layers = next.project?.layers ?? []
    expect(layers.map((layer) => layer.name)).toEqual(['Gameplay', 'Foreground'])
    const newId = layers[0]!.id
    expect(next.editorActiveLayerId).toBe(newId)
    expect(next.inspectorLayerId).toBe(newId)
    expect(next.projectDirty).toBe(true)
  })

  it('sets the global lock state on the targeted layer by id', () => {
    const next = coreReducer(state(), {
      type: 'LAYER_SET_LOCKED',
      layerId: 'lyr_fg',
      locked: true,
    })

    expect(next.project?.layers?.[0]).toMatchObject({ id: 'lyr_fg', locked: true })
    expect(next.projectDirty).toBe(true)
  })

  it('persists per-scene visual overrides and drops neutral values', () => {
    const hidden = coreReducer(state(), {
      type: 'SCENE_LAYER_SETTINGS_UPDATE',
      sceneId: 's',
      layerId: 'lyr_fg',
      patch: { visible: false, opacity: 0.4 },
    })
    expect(hidden.project?.scenes.s.layerSettings?.['lyr_fg']).toMatchObject({
      visible: false,
      opacity: 0.4,
    })

    const restored = coreReducer(hidden, {
      type: 'SCENE_LAYER_SETTINGS_UPDATE',
      sceneId: 's',
      layerId: 'lyr_fg',
      patch: { visible: true, opacity: 1 },
    })
    // Neutral settings are normalized away (no stale entry left behind).
    expect(restored.project?.scenes.s.layerSettings?.['lyr_fg']).toBeUndefined()
  })

  it('renames a layer in O(1) without touching instance references', () => {
    const base = state()
    base.project!.scenes.s.instances = [
      { id: 1, objectTypeId: 'Hero', transform: { position: { x: 0, y: 0 } }, layerId: 'lyr_fg' },
    ] as never
    const next = coreReducer(base, {
      type: 'LAYER_RENAME',
      layerId: 'lyr_fg',
      name: 'Renamed',
    })

    expect(next.project?.layers?.[0]).toMatchObject({ id: 'lyr_fg', name: 'Renamed' })
    // Instance still points at the same stable id after the rename.
    expect(next.project?.scenes.s.instances?.[0]?.layerId).toBe('lyr_fg')
  })

  it('reassigns orphaned instances and purges settings/tilemap on delete', () => {
    const base = state()
    base.project!.layers = [
      { id: 'lyr_fg', name: 'Foreground' },
      { id: 'lyr_bg', name: 'Background' },
    ]
    base.project!.scenes.s.instances = [
      { id: 1, objectTypeId: 'Hero', transform: { position: { x: 0, y: 0 } }, layerId: 'lyr_bg' },
    ] as never
    base.project!.scenes.s.layerSettings = { lyr_bg: { visible: false } }
    base.project!.scenes.s.tilemapLayers = {
      lyr_bg: { tileSize: 32, cols: 1, rows: 1, data: [1] },
    } as never

    const next = coreReducer(base, { type: 'LAYER_DELETE', layerId: 'lyr_bg' })

    expect(next.project?.layers?.map((l) => l.id)).toEqual(['lyr_fg'])
    // Orphan instance reassigned to the surviving fallback layer.
    expect(next.project?.scenes.s.instances?.[0]?.layerId).toBe('lyr_fg')
    expect(next.project?.scenes.s.layerSettings?.['lyr_bg']).toBeUndefined()
    expect(next.project?.scenes.s.tilemapLayers?.['lyr_bg']).toBeUndefined()
  })
})
