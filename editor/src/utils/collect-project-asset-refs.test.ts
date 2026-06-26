import { describe, expect, it } from 'vitest'
import type { ObjectTypeDef, ProjectDoc } from '../types'
import type { LogicBoard } from '../types/logic-board'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import { collectProjectAssetRefs, formatAssetDeleteBlockMessage } from './collect-project-asset-refs'

function baseProject(): ProjectDoc {
  return {
    ...createBlankProject('Refs'),
    assets: {
      hero: {
        id: 'hero',
        name: 'hero.png',
        path: 'assets/images/hero.png',
        usage: 'sprite',
        clips: [{ name: 'walk', fps: 8, loop: true, frames: [{ x: 0, y: 0, w: 16, h: 16 }] }],
      },
    },
    audioAssets: {
      coin: { id: 'coin', name: 'coin.ogg', path: 'assets/audio/coin.ogg', category: 'sfx' },
    },
    fontAssets: {
      ui: { id: 'ui', name: 'ui.ttf', path: 'assets/fonts/ui.ttf', defaultSize: 24 },
    },
    tilesets: {
      terrain: {
        assetId: 'terrain',
        name: 'Terrain',
        spriteImagePath: 'assets/tilesets/terrain.png',
        tileSize: 16,
        margin: 0,
        cols: 4,
        rows: 4,
      },
    },
  }
}

function objectTypeWithSprite(): ObjectTypeDef {
  const entity = createEntityDef(1, 'Player', 'Player', { x: 0, y: 0 })
  entity.sprite.spriteAssetId = 'hero'
  return {
    id: 'Player',
    displayName: 'Player',
    tags: entity.tags,
    sprite: entity.sprite,
  }
}

describe('collectProjectAssetRefs', () => {
  it('finds image references from object types and animation actions', () => {
    const project = baseProject()
    project.objectTypes = { Player: objectTypeWithSprite() }
    project.logicBoards = [{
      boardId: 'anim',
      name: 'Animation',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [{
        id: 'play',
        enabled: true,
        trigger: { type: 'onStart' },
        actions: [{ type: 'playAnimation', target: 'self', clipName: 'walk' }],
      }],
    }]

    const refs = collectProjectAssetRefs(project, {
      kind: 'image',
      id: 'hero',
      path: 'assets/images/hero.png',
    })

    expect(refs).toEqual([
      { kind: 'image', label: 'animation clip "walk"', location: 'Logic Board "Animation" event "play"' },
      { kind: 'image', label: 'sprite texture', location: 'Object type "Player"' },
    ])
  })

  it('finds audio references in actions and elseActions', () => {
    const project = baseProject()
    const board: LogicBoard = {
      boardId: 'audio',
      target: { type: 'global' },
      events: [{
        id: 'coin',
        enabled: true,
        trigger: { type: 'onStart' },
        actions: [{ type: 'playSound', audioAssetId: 'coin', volume: 1 }],
        elseActions: [{ type: 'playMusic', path: 'assets/audio/coin.ogg', loop: true }],
      }],
    }
    project.logicBoards = [board]

    const refs = collectProjectAssetRefs(project, {
      kind: 'audio',
      id: 'coin',
      path: 'assets/audio/coin.ogg',
    })

    expect(refs).toEqual([
      { kind: 'audio', label: 'playSound action', location: 'Logic Board "audio" event "coin"' },
      { kind: 'audio', label: 'playMusic action', location: 'Logic Board "audio" event "coin" else' },
    ])
  })

  it('finds font references from Text components', () => {
    const project = baseProject()
    const label = createEntityDef(2, 'ScoreLabel', 'Text', { x: 0, y: 0 })
    label.text = {
      text: 'Score',
      bindKey: '',
      format: 'raw',
      digits: 0,
      prefix: '',
      suffix: '',
      fontPath: 'assets/fonts/ui.ttf',
      size: 24,
      colorHex: '#ffffff',
      align: 'top-left',
      offsetX: 0,
      offsetY: 0,
      screenSpace: true,
    }
    project.entities = { 2: label }

    expect(collectProjectAssetRefs(project, {
      kind: 'font',
      id: 'ui',
      path: 'assets/fonts/ui.ttf',
    })).toEqual([
      { kind: 'font', label: 'text font', location: 'Object "ScoreLabel"' },
    ])
  })

  it('finds tileset references from scene tilemaps', () => {
    const project = baseProject()
    project.scenes.scene_main.tilemap = {
      tileSize: 16,
      cols: 2,
      rows: 1,
      data: [1, 0],
      tilesetAssetId: 'terrain',
    }

    expect(collectProjectAssetRefs(project, { kind: 'tileset', id: 'terrain' })).toEqual([
      { kind: 'tileset', label: 'tilemap layer', location: 'Scene "Main Scene" tilemap' },
    ])
  })

  it('formats blocking delete messages with dependency locations', () => {
    const message = formatAssetDeleteBlockMessage('hero.png', [
      { kind: 'image', label: 'sprite texture', location: 'Object type "Player"' },
    ])

    expect(message).toContain('Cannot remove "hero.png".')
    expect(message).toContain('- Object type "Player": sprite texture')
    expect(message).toContain('Remove or reassign these references first.')
  })
})
