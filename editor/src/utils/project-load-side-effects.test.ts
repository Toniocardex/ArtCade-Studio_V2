import { describe, expect, it, beforeEach } from 'vitest'
import { getProjectWorkbenchSnapshot, clearProjectWorkbenchCache } from './project-health'
import { runLoadProjectSideEffects } from './project-load-side-effects'
import type { ProjectDoc } from '../types'

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
  })

  it('clears workbench cache so snapshots are rebuilt', () => {
    const input = { project: minimalProject(), includeCompile: false }
    const cached = getProjectWorkbenchSnapshot(input)
    const cachedAgain = getProjectWorkbenchSnapshot(input)
    expect(cachedAgain).toBe(cached)

    runLoadProjectSideEffects()

    const rebuilt = getProjectWorkbenchSnapshot(input)
    expect(rebuilt).not.toBe(cached)
    expect(rebuilt.health).toEqual(cached.health)
  })
})
