import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createBlankProject } from '../../utils/project-factory'
import { performRuntimeSceneAssetSync } from './runtime-asset-sync'

const loadScene = vi.fn(async () => ({ ok: true, loaded: [], failed: [] }))
const prefetchScene = vi.fn()

vi.mock('../../utils/asset-orchestrator', () => ({
  assetOrchestrator: {
    loadScene: (...args: unknown[]) => loadScene(...args),
    prefetchScene: (...args: unknown[]) => prefetchScene(...args),
  },
}))

describe('performRuntimeSceneAssetSync', () => {
  beforeEach(() => {
    loadScene.mockClear()
    prefetchScene.mockClear()
  })

  it('loads active scene and prefetches others', () => {
    const project = {
      ...createBlankProject(),
      scenes: {
        scene_main: createBlankProject().scenes.scene_main,
        scene_b: {
          ...createBlankProject().scenes.scene_main,
          id: 'scene_b',
          name: 'B',
        },
      },
    }
    performRuntimeSceneAssetSync(project, 'scene_main', '/proj/game.artcade/project.json')
    expect(loadScene).toHaveBeenCalledWith(
      project, 'scene_main', '/proj/game.artcade', undefined,
    )
    expect(prefetchScene).toHaveBeenCalledWith(
      project, 'scene_b', '/proj/game.artcade', undefined,
    )
  })

  it('prefetches inactive scenes with scene-static when active uses spawn-prototypes', () => {
    const project = {
      ...createBlankProject(),
      scenes: {
        scene_main: createBlankProject().scenes.scene_main,
        scene_b: {
          ...createBlankProject().scenes.scene_main,
          id: 'scene_b',
          name: 'B',
        },
      },
    }
    const projectPath = '/proj/game.artcade/project.json'
    performRuntimeSceneAssetSync(project, 'scene_main', projectPath, {
      scope: 'scene+spawn-prototypes',
    })
    expect(loadScene).toHaveBeenCalledWith(
      project, 'scene_main', '/proj/game.artcade', { scope: 'scene+spawn-prototypes' },
    )
    expect(prefetchScene).toHaveBeenCalledWith(
      project, 'scene_b', '/proj/game.artcade', { scope: 'scene-static' },
    )
  })
})
