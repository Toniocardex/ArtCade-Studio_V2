/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  containsAssetPayload,
  libraryCategoryFolderId,
  parseFolderDropTarget,
  resolveFolderIdFromTarget,
  virtualAssetFolderId,
} from './asset-tree-dnd'
import { ARTCADE_ASSET_DND_MIME } from '../../utils/asset-explorer-dnd'

describe('asset-tree-dnd', () => {
  it('resolves deepest virtual folder button over library category parent', () => {
    const root = document.createElement('button')
    root.dataset.assetFolderId = libraryCategoryFolderId('images')

    const vf = document.createElement('button')
    vf.dataset.assetFolderId = virtualAssetFolderId('folder_2')
    const label = document.createElement('span')
    label.textContent = 'New Folder'
    vf.append(label)
    root.append(vf)
    document.body.append(root)

    expect(resolveFolderIdFromTarget(label)).toBe('folder_2')
    expect(parseFolderDropTarget('folder_2')).toEqual({
      kind: 'virtual-folder',
      folderId: 'folder_2',
    })

    root.remove()
  })

  it('resolves library category when pointer is on category header only', () => {
    const header = document.createElement('button')
    header.dataset.assetFolderId = libraryCategoryFolderId('images')
    header.textContent = 'Images'
    document.body.append(header)

    expect(resolveFolderIdFromTarget(header)).toBe('lib:images')
    expect(parseFolderDropTarget('lib:images')).toEqual({
      kind: 'library-category',
      category: 'images',
    })

    header.remove()
  })

  it('detects asset payload from drag MIME types only', () => {
    const withMime = { types: [ARTCADE_ASSET_DND_MIME] } as DataTransfer
    const withPlain = { types: ['text/plain'] } as DataTransfer
    const empty = { types: [] } as DataTransfer
    expect(containsAssetPayload(withMime)).toBe(true)
    expect(containsAssetPayload(withPlain)).toBe(true)
    expect(containsAssetPayload(empty)).toBe(false)
  })
})
