import { describe, expect, it } from 'vitest'
import { buildProjectAssetManifest } from './build-project-asset-manifest'
import { createBlankProject } from './project-factory'

describe('exportArtcadePackage manifest', () => {
  it('buildProjectAssetManifest lists library entries with checksums', () => {
    const project = createBlankProject()
    project.assets = {
      img1: { id: 'img1', name: 'Hero', path: 'assets/images/hero.png' },
    }
    const manifest = buildProjectAssetManifest(project, {
      'assets/images/hero.png': 'abc123',
      'project.json': 'def456',
    })
    expect(manifest.assets).toHaveLength(1)
    expect(manifest.assets[0]).toMatchObject({
      id: 'img1',
      type: 'image',
      relativePath: 'assets/images/hero.png',
      sha256: 'abc123',
    })
    expect(manifest.checksums['project.json']).toBe('def456')
  })
})
