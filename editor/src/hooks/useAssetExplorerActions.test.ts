/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  moveImportedAssetToFolderAction,
  shouldOpenSpritesheetStudioOnExplorerEnter,
} from './useAssetExplorerActions'
import { spritesheetStudioTriggerProps } from '../panels/spritesheet-studio/openSpritesheetStudio'

describe('moveImportedAssetToFolderAction', () => {
  it('creates a folder move action only when an import targets a custom folder', () => {
    expect(moveImportedAssetToFolderAction({}, 'audio', 'audio1')).toBeNull()
    expect(moveImportedAssetToFolderAction({ folderId: 'folder1' }, 'font', 'font1')).toEqual({
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId: 'folder1',
      assetType: 'font',
      assetId: 'font1',
    })
    expect(
      moveImportedAssetToFolderAction({ folderId: 'tiles' }, 'tileset', 'tileset1'),
    ).toEqual({
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId: 'tiles',
      assetType: 'tileset',
      assetId: 'tileset1',
    })
  })
})

describe('shouldOpenSpritesheetStudioOnExplorerEnter', () => {
  it('requires Enter on a marked trigger with image selection', () => {
    const btn = document.createElement('button')
    Object.entries(spritesheetStudioTriggerProps).forEach(([k, v]) => btn.setAttribute(k, v))
    document.body.append(btn)
    btn.focus()

    expect(
      shouldOpenSpritesheetStudioOnExplorerEnter(
        { key: 'Enter', target: btn },
        { type: 'image', id: 'img1' },
      ),
    ).toBe(true)

    expect(
      shouldOpenSpritesheetStudioOnExplorerEnter(
        { key: 'Enter', target: btn },
        { type: 'audio', id: 'a1' },
      ),
    ).toBe(false)

    const plain = document.createElement('button')
    document.body.append(plain)
    expect(
      shouldOpenSpritesheetStudioOnExplorerEnter(
        { key: 'Enter', target: plain },
        { type: 'image', id: 'img1' },
      ),
    ).toBe(false)

    btn.remove()
    plain.remove()
  })
})
