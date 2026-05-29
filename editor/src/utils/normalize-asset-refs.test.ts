import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import { normalizeAssetRefs } from './normalize-asset-refs'

describe('normalizeAssetRefs', () => {
  it('rewrites sprite path to library id', () => {
    const path = 'assets/images/hero.png'
    const project = createBlankProject()
    project.assets = { img1: { id: 'img1', name: 'Hero', path } }
    project.entities[1] = {
      ...createEntityDef(1, 'Hero', 'Player'),
      sprite: { ...createEntityDef(1, 'Hero', 'Player').sprite, spriteAssetId: path },
    }
    const { changed, project: next } = normalizeAssetRefs(project)
    expect(changed).toBe(1)
    expect(next.entities[1].sprite.spriteAssetId).toBe('img1')
  })
})
