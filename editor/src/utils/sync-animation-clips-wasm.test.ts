import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../types'
import { animationClipsPayloadForWasm } from './sync-animation-clips-wasm'

describe('sync-animation-clips-wasm', () => {
  it('serializes assets with clips for C++ parseImageAssets', () => {
    const project: ProjectDoc = {
      projectName: 'T',
      version: '2.0.0',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      entities: {},
      scenes: {},
      assets: {
        hero: {
          id: 'hero',
          name: 'hero.png',
          path: 'assets/images/hero.png',
          clips: [
            {
              name: 'walk',
              fps: 10,
              loop: true,
              frames: [{ x: 0, y: 0, w: 32, h: 32 }],
            },
          ],
        },
      },
    }
    const parsed = JSON.parse(animationClipsPayloadForWasm(project)) as {
      assets: Record<string, { path: string; clips: unknown[] }>
    }
    expect(parsed.assets.hero.path).toBe('assets/images/hero.png')
    expect(parsed.assets.hero.clips).toHaveLength(1)
  })
})
