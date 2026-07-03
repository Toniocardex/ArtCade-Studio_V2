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
})
