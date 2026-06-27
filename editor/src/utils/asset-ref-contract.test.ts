import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import { isPathLikeAssetRef, isStableImageAssetRef, stableImageAssetIdForRef } from './asset-ref-contract'
import { validateProjectBeforeSave } from './logic-board/validate-project'
import { assertProjectDiagnosticsClean } from './project-validator'

describe('asset-ref-contract', () => {
  it('detects path-like refs and stable library ids', () => {
    const project = createBlankProject()
    project.assets = { img_hero: { id: 'img_hero', name: 'Hero', path: 'assets/images/hero.png' } }

    expect(isPathLikeAssetRef('assets/images/hero.png')).toBe(true)
    expect(isPathLikeAssetRef('img_hero')).toBe(false)
    expect(isStableImageAssetRef(project, 'img_hero')).toBe(true)
    expect(isStableImageAssetRef(project, 'assets/images/hero.png')).toBe(false)
    expect(stableImageAssetIdForRef(project, 'assets/images/hero.png')).toBe('img_hero')
  })

  it('allows save when sprite refs use stable ids', () => {
    const project = createBlankProject()
    project.assets = { img_hero: { id: 'img_hero', name: 'Hero', path: 'assets/images/hero.png' } }
    project.objectTypes = {
      Player: {
        id: 'Player',
        displayName: 'Player',
        tags: [],
        sprite: {
          ...createEntityDef(1, 'Player', 'Player').sprite,
          spriteAssetId: 'img_hero',
        },
      },
    }
    project.scenes.scene_main.instances = [{
      id: 1,
      objectTypeId: 'Player',
      transform: createEntityDef(1, 'Player', 'Player').transform,
    }]

    expect(() => validateProjectBeforeSave(project)).not.toThrow()
  })

  it('blocks save when a path-shaped sprite ref can be rewritten to a stable id', () => {
    const path = 'assets/images/hero.png'
    const project = createBlankProject()
    project.assets = { img_hero: { id: 'img_hero', name: 'Hero', path } }
    project.objectTypes = {
      Player: {
        id: 'Player',
        displayName: 'Player',
        tags: [],
        sprite: {
          ...createEntityDef(1, 'Player', 'Player').sprite,
          spriteAssetId: path,
        },
      },
    }
    project.scenes.scene_main.instances = [{
      id: 1,
      objectTypeId: 'Player',
      transform: createEntityDef(1, 'Player', 'Player').transform,
    }]
    project.entities[1] = createEntityDef(1, 'Player', 'Player')

    expect(() => assertProjectDiagnosticsClean(project)).toThrow(/stable asset id "img_hero"/)
  })
})
