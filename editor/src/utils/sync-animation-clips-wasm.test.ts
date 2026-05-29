import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ProjectDoc } from '../types'
import { animationClipsPayloadForWasm, syncAnimationClipsToWasm } from './sync-animation-clips-wasm'

vi.mock('./wasm-bridge', () => ({
  isReady: vi.fn(() => true),
  editorReregisterAnimationClips: vi.fn(() => 0),
}))

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

  it('omits assets without clips from payload', () => {
    const project: ProjectDoc = {
      projectName: 'T',
      version: '2.0.0',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      entities: {},
      scenes: {},
      assets: {
        hero: { id: 'hero', name: 'hero.png', path: 'assets/images/hero.png' },
        sidekick: {
          id: 'sidekick',
          name: 'side.png',
          path: 'assets/images/side.png',
          clips: [{ name: 'idle', frames: [{ x: 0, y: 0, w: 8, h: 8 }], fps: 6, loop: true }],
        },
      },
    }
    const parsed = JSON.parse(animationClipsPayloadForWasm(project)) as {
      assets: Record<string, unknown>
    }
    expect(parsed.assets.hero).toBeUndefined()
    expect(parsed.assets.sidekick).toBeDefined()
  })
})

describe('syncAnimationClipsToWasm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when project is null', () => {
    expect(syncAnimationClipsToWasm(null)).toBe(false)
  })
})
