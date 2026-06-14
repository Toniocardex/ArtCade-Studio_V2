import { describe, expect, it } from 'vitest'
import { createEntityDef } from './project-builders'
import { createBlankProject } from './project-factory'
import {
  buildObjectModelFromEntities,
  migrateLegacyProject,
} from './project-object-types'
import { collectSceneAssetRefs, collectSceneAudioRefs } from './collect-scene-asset-refs'
import type { LogicBoard } from '../types/logic-board'

const IMG_A = 'assets/images/a.png'
const IMG_B = 'assets/images/b.png'
const TILE_IMG = 'assets/images/tiles.png'

function projectWithTwoScenes() {
  const base = migrateLegacyProject({
    ...createBlankProject('AssetRefs'),
    assets: {
      img_a: { id: 'img_a', name: 'A', path: IMG_A },
      img_b: { id: 'img_b', name: 'B', path: IMG_B },
    },
    tilesets: {
      ts1: {
        id: 'ts1',
        name: 'Tiles',
        spriteImagePath: TILE_IMG,
        cellWidth: 16,
        cellHeight: 16,
        cols: 4,
        rows: 4,
      },
    },
    entities: {
      1: {
        ...createEntityDef(1, 'Hero', 'Hero'),
        sprite: { ...createEntityDef(1, 'Hero', 'Hero').sprite, spriteAssetId: IMG_A },
      },
      2: {
        ...createEntityDef(2, 'Hero2', 'Hero'),
        sprite: { ...createEntityDef(2, 'Hero2', 'Hero').sprite, spriteAssetId: IMG_A },
      },
      3: {
        ...createEntityDef(3, 'Other', 'Other'),
        sprite: { ...createEntityDef(3, 'Other', 'Other').sprite, spriteAssetId: IMG_B },
        visible: false,
      },
    },
    scenes: {
      scene_main: {
        ...createBlankProject().scenes.scene_main,
        entityIds: [1, 2],
      },
      scene_b: {
        id: 'scene_b',
        name: 'B',
        worldSize: createBlankProject().scenes.scene_main.worldSize,
        viewportSize: createBlankProject().scenes.scene_main.viewportSize,
        backgroundColor: createBlankProject().scenes.scene_main.backgroundColor,
        entityIds: [3],
        tilemap: {
          tileSize: 16,
          cols: 4,
          rows: 4,
          data: [0, 0, 0, 0],
          tilesetAssetId: 'ts1',
        },
      },
    },
  })
  return base
}

describe('collectSceneAssetRefs', () => {
  it('deduplicates two instances with the same spriteAssetId', () => {
    const p = projectWithTwoScenes()
    expect(collectSceneAssetRefs(p, 'scene_main')).toEqual([IMG_A])
  })

  it('includes hidden instances by default', () => {
    const p = projectWithTwoScenes()
    expect(collectSceneAssetRefs(p, 'scene_b')).toEqual([IMG_B, TILE_IMG])
  })

  it('excludes hidden instances when includeHiddenInstances is false', () => {
    const p = projectWithTwoScenes()
    expect(
      collectSceneAssetRefs(p, 'scene_b', { includeHiddenInstances: false }),
    ).toEqual([TILE_IMG])
  })

  it('returns the same tileset path from two scenes', () => {
    const p = projectWithTwoScenes()
    p.scenes.scene_main.tilemap = {
      tileSize: 16,
      cols: 4,
      rows: 4,
      data: [0, 0, 0, 0],
      tilesetAssetId: 'ts1',
    }
    expect(collectSceneAssetRefs(p, 'scene_main')).toContain(TILE_IMG)
    expect(collectSceneAssetRefs(p, 'scene_b')).toContain(TILE_IMG)
    expect(collectSceneAssetRefs(p, 'scene_main').filter((k) => k === TILE_IMG)).toEqual(
      collectSceneAssetRefs(p, 'scene_b').filter((k) => k === TILE_IMG),
    )
  })

  it('skips empty spriteAssetId', () => {
    const p = projectWithTwoScenes()
    p.entities[1] = {
      ...p.entities[1],
      sprite: { ...p.entities[1].sprite, spriteAssetId: '' },
    }
    p.entities[2] = {
      ...p.entities[2],
      sprite: { ...p.entities[2].sprite, spriteAssetId: '   ' },
    }
    expect(collectSceneAssetRefs(p, 'scene_main')).toEqual([])
  })

  it('uses project.entities override for sprite path (v2 materialize)', () => {
    const migrated = migrateLegacyProject({
      ...createBlankProject(),
      assets: {
        img_a: { id: 'img_a', name: 'A', path: IMG_A },
        img_b: { id: 'img_b', name: 'B', path: IMG_B },
      },
      entities: {
        1: createEntityDef(1, 'Player', 'Player'),
      },
      scenes: {
        scene_main: {
          ...createBlankProject().scenes.scene_main,
          entityIds: [1],
        },
      },
    })
    const { objectTypes } = buildObjectModelFromEntities(migrated)
    migrated.objectTypes = objectTypes
    migrated.scenes.scene_main.instances = [
      {
        id: 1,
        objectTypeId: 'Player',
        transform: migrated.entities[1].transform,
      },
    ]
    migrated.entities[1] = {
      ...migrated.entities[1],
      sprite: {
        ...migrated.entities[1].sprite,
        spriteAssetId: IMG_B,
      },
    }
    expect(collectSceneAssetRefs(migrated, 'scene_main')).toEqual([IMG_B])
  })

  it('returns empty array for unknown sceneId', () => {
    const p = projectWithTwoScenes()
    expect(collectSceneAssetRefs(p, 'missing')).toEqual([])
  })

  it('collectSceneAudioRefs resolves audioAssetId and legacy path', () => {
    const p = projectWithTwoScenes()
    p.audioAssets = {
      sfx: { id: 'sfx', name: 'Coin', path: 'assets/audio/coin.ogg' },
    }
    const board: LogicBoard = {
      boardId: 'audio',
      target: { type: 'object_type', objectTypeId: 'Hero' },
      events: [
        {
          trigger: { type: 'onStart' },
          actions: [
            { type: 'playSound', audioAssetId: 'sfx', volume: 1 },
            { type: 'playMusic', path: 'assets/audio/theme.ogg', loop: true },
          ],
        },
      ],
    }
    p.logicBoards = [board]
    expect(collectSceneAudioRefs(p, 'scene_main')).toEqual([
      'assets/audio/coin.ogg',
      'assets/audio/theme.ogg',
    ])
  })
})
