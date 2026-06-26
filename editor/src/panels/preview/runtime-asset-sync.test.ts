import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createBlankProject } from '../../utils/project-factory'
import { performRuntimeSceneAssetSync } from './runtime-asset-sync'

const loadScene = vi.fn(async () => ({ ok: true, loaded: [], failed: [] }))
const prefetchScenes = vi.fn()

vi.mock('../../utils/asset-orchestrator', () => ({
  assetOrchestrator: {
    loadScene: (...args: unknown[]) => loadScene(...args),
    prefetchScenes: (...args: unknown[]) => prefetchScenes(...args),
  },
}))

describe('performRuntimeSceneAssetSync', () => {
  beforeEach(() => {
    loadScene.mockClear()
    prefetchScenes.mockClear()
  })

  it('loads active scene and prefetches others', async () => {
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
    await performRuntimeSceneAssetSync(project, 'scene_main', '/proj/game.artcade/project.json')
    expect(loadScene).toHaveBeenCalledWith(
      project, 'scene_main', '/proj/game.artcade',
    )
    expect(prefetchScenes).toHaveBeenCalledWith(
      project, ['scene_b'], '/proj/game.artcade',
    )
  })
})
