import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import { buildProjectAssetManifest } from './build-project-asset-manifest'

describe('buildProjectAssetManifest', () => {
  it('lists image, audio, and font entries with stable ids', () => {
    const project = createBlankProject()
    project.assets = {
      img1: { id: 'img1', name: 'Hero', path: 'assets/images/hero.png' },
    }
    project.audioAssets = {
      snd1: { id: 'snd1', name: 'Jump', path: 'assets/audio/jump.ogg' },
    }
    project.fontAssets = {
      f1: { id: 'f1', name: 'Main', path: 'assets/fonts/main.ttf', defaultSize: 24 },
    }

    const manifest = buildProjectAssetManifest(project, {
      'assets/images/hero.png': 'abc',
      'assets/audio/jump.ogg': 'def',
    })

    expect(manifest.assets).toHaveLength(3)
    expect(manifest.assets[0]).toEqual({
      id: 'snd1',
      type: 'audio',
      relativePath: 'assets/audio/jump.ogg',
      sha256: 'def',
    })
    expect(manifest.assets.find((a) => a.id === 'img1')).toMatchObject({
      type: 'image',
      relativePath: 'assets/images/hero.png',
      sha256: 'abc',
    })
    expect(manifest.checksums['assets/images/hero.png']).toBe('abc')
  })

  it('skips library rows without a path', () => {
    const project = createBlankProject()
    project.assets = {
      bad: { id: 'bad', name: 'X', path: '' },
    }
    expect(buildProjectAssetManifest(project).assets).toEqual([])
  })
})
