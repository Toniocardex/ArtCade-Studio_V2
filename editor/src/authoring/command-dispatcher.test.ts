import { describe, expect, it, vi } from 'vitest'
import { dispatchAuthoringCommand } from './command-dispatcher'

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
