import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../types'
import { findDuplicateClipNameAcrossAssets } from './spritesheet-clip-names'

describe('spritesheet-clip-names', () => {
  const project: ProjectDoc = {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {},
    assets: {
      a: {
        id: 'a',
        name: 'hero.png',
        path: 'assets/images/hero.png',
        clips: [{ name: 'walk', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 12, loop: true }],
      },
      b: {
        id: 'b',
        name: 'enemy.png',
        path: 'assets/images/enemy.png',
        clips: [{ name: 'walk', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true }],
      },
    },
  }

  it('detects duplicate clip names on other assets', () => {
    expect(findDuplicateClipNameAcrossAssets(project, 'walk', 'a')).toBe('enemy.png')
    expect(findDuplicateClipNameAcrossAssets(project, 'walk', 'b')).toBe('hero.png')
  })

  it('returns null for unique names', () => {
    expect(findDuplicateClipNameAcrossAssets(project, 'run', 'a')).toBeNull()
  })
})
