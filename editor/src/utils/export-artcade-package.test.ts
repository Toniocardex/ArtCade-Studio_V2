import { describe, expect, it } from 'vitest'
import { buildProjectAssetManifest } from './build-project-asset-manifest'
import { createBlankProject } from './project-factory'
import { buildArtcadeZipBytes } from './export-artcade-package'
import { parseArtcadePackageBytes } from './artcade-zip-parse'
import { createEntityDef } from './project-builders'

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

describe('buildArtcadeZipBytes round-trip', () => {
  it('parses project.json and manifest from exported zip', async () => {
    const project = createBlankProject()
    project.assets = {
      img1: { id: 'img1', name: 'Hero', path: 'assets/images/hero.png' },
    }
    project.entities[1] = {
      ...createEntityDef(1, 'Hero', 'Player'),
      sprite: { ...createEntityDef(1, 'Hero', 'Player').sprite, spriteAssetId: 'img1' },
    }
    const heroPng = new Uint8Array([137, 80, 78, 71])
    const zip = await buildArtcadeZipBytes(project, {
      'assets/images/hero.png': heroPng,
    })
    const parsed = await parseArtcadePackageBytes(zip)
    expect(parsed.project.name).toBe(project.name)
    expect(parsed.project.assets?.img1?.path).toBe('assets/images/hero.png')
    expect(parsed.manifest?.assets.some((a) => a.id === 'img1')).toBe(true)
  })

  it('rejects traversal and reserved extra file paths', async () => {
    const project = createBlankProject()
    await expect(buildArtcadeZipBytes(project, {
      '../secret.lua': new Uint8Array([1]),
    })).rejects.toThrow(/extra file path/)
    await expect(buildArtcadeZipBytes(project, {
      'project.json': new Uint8Array([1]),
    })).rejects.toThrow(/reserved/)
  })
})
