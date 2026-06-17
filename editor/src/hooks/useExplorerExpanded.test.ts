import { describe, expect, it } from 'vitest'
import {
  applyCollapseAllAssetFolders,
  applyExpandAllAssetFolders,
  areAllAssetLibraryFoldersExpanded,
} from './useExplorerExpanded'

describe('asset library folder expand helpers', () => {
  it('areAllAssetLibraryFoldersExpanded requires every category open', () => {
    expect(areAllAssetLibraryFoldersExpanded({})).toBe(true)
    expect(areAllAssetLibraryFoldersExpanded({ 'asset:scripts': false })).toBe(false)
    expect(
      areAllAssetLibraryFoldersExpanded({
        'asset:audio': true,
        'asset:fonts': true,
        'asset:images': true,
        'asset:scripts': true,
        'asset:tilesets': true,
      }),
    ).toBe(true)
  })

  it('applyExpandAllAssetFolders opens all library categories', () => {
    const next = applyExpandAllAssetFolders({ 'asset:images': false, 'asset:scripts': false })
    expect(next['asset:images']).toBe(true)
    expect(next['asset:scripts']).toBe(true)
    expect(areAllAssetLibraryFoldersExpanded(next)).toBe(true)
  })

  it('applyCollapseAllAssetFolders closes library and virtual folders', () => {
    const next = applyCollapseAllAssetFolders({
      'asset:images': true,
      'asset:vf:folder_1': true,
    })
    expect(next['asset:images']).toBe(false)
    expect(next['asset:vf:folder_1']).toBe(false)
    expect(areAllAssetLibraryFoldersExpanded(next)).toBe(false)
  })
})
