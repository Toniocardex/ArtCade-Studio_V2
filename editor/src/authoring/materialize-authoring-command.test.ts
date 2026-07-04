import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../types'
import { materializeAuthoringCommand } from './materialize-authoring-command'

describe('materializeAuthoringCommand', () => {
  it('materializes commands without dispatching from the core layer', () => {
    expect(materializeAuthoringCommand(
      { type: 'project.rename', name: 'My Game' },
    )).toEqual({
      status: 'applied',
      actions: [{ type: 'PROJECT_RENAME', name: 'My Game' }],
    })

    expect(materializeAuthoringCommand(
      { type: 'scene.instance.rename', entityId: 7, name: 'Hero Instance' },
    )).toEqual({
      status: 'applied',
      actions: [{ type: 'ENTITY_SET_NAME', entityId: 7, name: 'Hero Instance' }],
    })
  })

  it('materializes asset upserts behind the command boundary', () => {
    expect(materializeAuthoringCommand({
      type: 'asset.image.upsert',
      asset: {
        id: 'hero',
        name: 'Hero',
        path: 'assets/hero.png',
        usage: 'sprite',
      },
    })).toEqual({
      status: 'applied',
      actions: [{
        type: 'ASSET_ADD',
        asset: {
          id: 'hero',
          name: 'Hero',
          path: 'assets/hero.png',
          usage: 'sprite',
        },
      }],
    })

    expect(materializeAuthoringCommand({
      type: 'asset.tileset.upsert',
      asset: {
        assetId: 'tileset_a',
        name: 'Dungeon',
        spriteImagePath: 'assets/tilesets/dungeon.png',
        tileSize: 16,
        margin: 0,
        cols: 4,
        rows: 4,
      },
    })).toEqual({
      status: 'applied',
      actions: [{
        type: 'TILESET_ASSET_ADD',
        asset: {
          assetId: 'tileset_a',
          name: 'Dungeon',
          spriteImagePath: 'assets/tilesets/dungeon.png',
          tileSize: 16,
          margin: 0,
          cols: 4,
          rows: 4,
        },
      }],
    })
  })

  it('uses the ProjectDocument snapshot to materialize image patches', () => {
    const project = {
      assets: {
        hero: {
          id: 'hero',
          name: 'Hero',
          path: 'assets/hero.png',
          usage: 'sprite',
        },
      },
    } as unknown as ProjectDoc

    expect(materializeAuthoringCommand(
      { type: 'asset.image.patch', assetId: 'hero', patch: { usage: 'ui' } },
      { project },
    )).toEqual({
      status: 'applied',
      actions: [{
        type: 'ASSET_ADD',
        asset: {
          id: 'hero',
          name: 'Hero',
          path: 'assets/hero.png',
          usage: 'ui',
        },
      }],
    })
  })

  it('blocks document-dependent commands when the target is missing', () => {
    expect(materializeAuthoringCommand(
      { type: 'asset.image.patch', assetId: 'missing', patch: { usage: 'ui' } },
      { project: { assets: {} } as unknown as ProjectDoc },
    )).toEqual({ status: 'validation-error', reason: 'image-asset-not-found' })
  })
})
