import { describe, expect, it, beforeEach } from 'vitest'
import { getProjectWorkbenchSnapshot, clearProjectWorkbenchCache } from './project-health'
import { runLoadProjectSideEffects } from './project-load-side-effects'
import type { ProjectDoc } from '../types'
import {
  clearPendingAssets,
  pendingAssetCount,
  readPendingAsset,
  stagePendingAsset,
} from './pending-asset-store'

function minimalProject(): ProjectDoc {
  return {
    projectName: 'CacheTest',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's1',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {
      s1: {
        id: 's1',
        name: 'S1',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [],
      },
    },
  }
}

describe('runLoadProjectSideEffects', () => {
  beforeEach(() => {
    clearProjectWorkbenchCache()
    clearPendingAssets()
  })

  it('clears workbench cache so snapshots are rebuilt', () => {
    const input = { project: minimalProject(), includeCompile: false }
    const cached = getProjectWorkbenchSnapshot(input)
    const cachedAgain = getProjectWorkbenchSnapshot(input)
    expect(cachedAgain).toBe(cached)

    runLoadProjectSideEffects(null)

    const rebuilt = getProjectWorkbenchSnapshot(input)
    expect(rebuilt).not.toBe(cached)
    expect(rebuilt.health).toEqual(cached.health)
  })

  it('drops staged bytes when no project context is supplied', () => {
    stagePendingAsset('assets/images/old.png', new Uint8Array([1]))
    expect(pendingAssetCount()).toBe(1)

    runLoadProjectSideEffects('/projects/new/project.json')

    expect(pendingAssetCount()).toBe(0)
  })

  it('retains staged bytes the loaded project still references', () => {
    // The lost-texture root cause: a load between import and save must NOT drop
    // bytes the loaded project still points at.
    const kept = 'assets/images/img_kept.png'
    stagePendingAsset(kept, new Uint8Array([1]))
    stagePendingAsset('assets/images/img_orphan.png', new Uint8Array([2]))
    expect(pendingAssetCount()).toBe(2)

    const project = minimalProject()
    project.assets = {
      img_kept: { id: 'img_kept', name: 'kept.png', usage: 'sprite', path: kept },
    }

    runLoadProjectSideEffects('/projects/new/project.json', project)

    // The referenced one survives; the orphan is freed.
    expect(pendingAssetCount()).toBe(1)
    expect(readPendingAsset(kept)).not.toBeNull()
  })
})
