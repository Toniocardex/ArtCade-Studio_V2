import { describe, expect, it, vi } from 'vitest'
import { dispatchAuthoringCommand } from './command-dispatcher'
import type { ProjectDoc } from '../types'

describe('dispatchAuthoringCommand', () => {
  it('routes project.rename through the single authoring boundary', () => {
    const dispatch = vi.fn()
    const result = dispatchAuthoringCommand(
      { type: 'project.rename', name: 'My Game' },
      { dispatch },
    )

    expect(result).toEqual({ status: 'applied' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'PROJECT_RENAME', name: 'My Game' })
  })

  it('routes asset.delete to the current asset reducers behind the boundary', () => {
    const cases = [
      [{ type: 'asset.delete', kind: 'image', assetId: 'img_a' }, { type: 'ASSET_REMOVE', assetId: 'img_a' }],
      [{ type: 'asset.delete', kind: 'audio', assetId: 'sfx_a' }, { type: 'AUDIO_ASSET_REMOVE', assetId: 'sfx_a' }],
      [{ type: 'asset.delete', kind: 'font', assetId: 'font_a' }, { type: 'FONT_ASSET_REMOVE', assetId: 'font_a' }],
      [{ type: 'asset.delete', kind: 'tileset', assetId: 'tileset_a' }, { type: 'TILESET_ASSET_REMOVE', assetId: 'tileset_a' }],
    ] as const

    for (const [command, action] of cases) {
      const dispatch = vi.fn()
      expect(dispatchAuthoringCommand(command, { dispatch })).toEqual({ status: 'applied' })
      expect(dispatch).toHaveBeenCalledWith(action)
    }
  })

  it('routes asset rename commands behind the boundary', () => {
    const cases = [
      [{ type: 'asset.rename', kind: 'image', assetId: 'img_a', name: 'Hero' }, { type: 'IMAGE_ASSET_RENAME', assetId: 'img_a', name: 'Hero' }],
      [{ type: 'asset.rename', kind: 'audio', assetId: 'sfx_a', name: 'Jump' }, { type: 'AUDIO_ASSET_RENAME', assetId: 'sfx_a', name: 'Jump' }],
      [{ type: 'asset.rename', kind: 'font', assetId: 'font_a', name: 'Body' }, { type: 'FONT_ASSET_RENAME', assetId: 'font_a', name: 'Body' }],
      [{ type: 'asset.rename', kind: 'tileset', assetId: 'tileset_a', name: 'Dungeon' }, { type: 'TILESET_ASSET_RENAME', assetId: 'tileset_a', name: 'Dungeon' }],
    ] as const

    for (const [command, action] of cases) {
      const dispatch = vi.fn()
      expect(dispatchAuthoringCommand(command, { dispatch })).toEqual({ status: 'applied' })
      expect(dispatch).toHaveBeenCalledWith(action)
    }
  })

  it('patches image assets from the project document snapshot', () => {
    const dispatch = vi.fn()
    const project = {
      assets: {
        img_a: {
          id: 'img_a',
          name: 'Hero',
          path: 'assets/hero.png',
          usage: 'sprite',
        },
      },
    } as unknown as ProjectDoc

    const result = dispatchAuthoringCommand(
      { type: 'asset.image.patch', assetId: 'img_a', patch: { usage: 'ui' } },
      { dispatch, project },
    )

    expect(result).toEqual({ status: 'applied' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ASSET_ADD',
      asset: {
        id: 'img_a',
        name: 'Hero',
        path: 'assets/hero.png',
        usage: 'ui',
      },
    })
  })

  it('rejects image asset patches without a document asset', () => {
    const dispatch = vi.fn()
    const result = dispatchAuthoringCommand(
      { type: 'asset.image.patch', assetId: 'missing', patch: { usage: 'ui' } },
      { dispatch, project: { assets: {} } as unknown as ProjectDoc },
    )

    expect(result).toEqual({ status: 'validation-error', reason: 'image-asset-not-found' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('routes image clip updates behind the boundary', () => {
    const dispatch = vi.fn()
    const clips = [{ name: 'idle', frames: [], fps: 8, loop: true }]

    expect(dispatchAuthoringCommand(
      { type: 'asset.image.setClips', assetId: 'img_a', clips, coalesceKey: 'clips:img_a' },
      { dispatch },
    )).toEqual({ status: 'applied' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'IMAGE_ASSET_SET_CLIPS',
      assetId: 'img_a',
      clips,
      coalesceKey: 'clips:img_a',
    })
  })

  it('routes scene and instance commands behind the boundary', () => {
    const cases = [
      [{ type: 'scene.addEmpty', sourceSceneId: 'scene_a' }, { type: 'SCENE_ADD_EMPTY', sourceSceneId: 'scene_a' }],
      [{ type: 'scene.rename', sceneId: 'scene_a', name: 'Battle' }, { type: 'SCENE_RENAME', sceneId: 'scene_a', name: 'Battle' }],
      [{ type: 'scene.setStart', sceneId: 'scene_a' }, { type: 'SCENE_SET_START', sceneId: 'scene_a' }],
      [{ type: 'scene.delete', sceneId: 'scene_b' }, { type: 'SCENE_DELETE', sceneId: 'scene_b' }],
      [{ type: 'scene.duplicate', sceneId: 'scene_a' }, { type: 'SCENE_DUPLICATE', sceneId: 'scene_a' }],
      [
        { type: 'scene.instance.addFromType', sceneId: 'scene_a', objectTypeId: 'coin' },
        { type: 'INSTANCE_ADD_FROM_TYPE', sceneId: 'scene_a', objectTypeId: 'coin' },
      ],
      [
        { type: 'scene.instance.duplicate', sceneId: 'scene_a', instanceId: 42 },
        { type: 'INSTANCE_DUPLICATE', sceneId: 'scene_a', instanceId: 42 },
      ],
      [
        { type: 'scene.instance.setVisible', entityId: 42, visible: false },
        { type: 'ENTITY_SET_VISIBLE', entityId: 42, visible: false },
      ],
      [
        { type: 'scene.instance.rename', entityId: 42, name: 'Coin A' },
        { type: 'ENTITY_SET_NAME', entityId: 42, name: 'Coin A' },
      ],
      [
        { type: 'objectType.rename', objectTypeId: 'coin', displayName: 'Coin' },
        { type: 'OBJECT_TYPE_RENAME', objectTypeId: 'coin', displayName: 'Coin' },
      ],
    ] as const

    for (const [command, action] of cases) {
      const dispatch = vi.fn()
      expect(dispatchAuthoringCommand(command, { dispatch })).toEqual({ status: 'applied' })
      expect(dispatch).toHaveBeenCalledWith(action)
    }
  })
})
