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

  it('rewrites logic board playSound path to audioAssetId', () => {
    const path = 'assets/audio/coin.ogg'
    const project = createBlankProject()
    project.audioAssets = { sfx1: { id: 'sfx1', name: 'Coin', path } }
    project.logicBoards = [
      {
        boardId: 'lb1',
        name: 'Main',
        target: { type: 'global' },
        events: [
          {
            id: 'ev1',
            trigger: { type: 'onStart' },
            actions: [{ type: 'playSound', path, volume: 1 }],
          },
        ],
      },
    ]
    const { changed, project: next } = normalizeAssetRefs(project)
    expect(changed).toBe(1)
    expect(next.logicBoards?.[0].events[0].actions[0]).toEqual({
      type: 'playSound',
      audioAssetId: 'sfx1',
      volume: 1,
    })
  })

  it('rewrites playMusic path in elseActions branch', () => {
    const path = 'assets/audio/theme.ogg'
    const project = createBlankProject()
    project.audioAssets = { mus1: { id: 'mus1', name: 'Theme', path } }
    project.logicBoards = [
      {
        boardId: 'lb1',
        name: 'Main',
        target: { type: 'global' },
        events: [
          {
            id: 'ev1',
            trigger: { type: 'onStart' },
            actions: [],
            elseEnabled: true,
            elseActions: [{ type: 'playMusic', path, loop: true }],
          },
        ],
      },
    ]
    const { changed, project: next } = normalizeAssetRefs(project)
    expect(changed).toBe(1)
    expect(next.logicBoards?.[0].events[0].elseActions?.[0]).toEqual({
      type: 'playMusic',
      audioAssetId: 'mus1',
      loop: true,
    })
  })
})
