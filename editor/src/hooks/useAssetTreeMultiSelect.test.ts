import { describe, expect, it } from 'vitest'
import { assetTreeMultiSelectReducer } from './useAssetTreeMultiSelect'
import { virtualAssetRefKey } from '../utils/asset-virtual-folders'

describe('assetTreeMultiSelectReducer', () => {
  it('replaces selection on plain click', () => {
    const next = assetTreeMultiSelectReducer(
      { activeCategory: 'images', selectedKeys: new Set(['image:a']) },
      { type: 'click', category: 'images', refType: 'image', refId: 'b', additive: false },
    )
    expect([...next.selectedKeys]).toEqual([virtualAssetRefKey('image', 'b')])
  })

  it('toggles on additive click within category', () => {
    let state = assetTreeMultiSelectReducer(
      { activeCategory: null, selectedKeys: new Set() },
      { type: 'click', category: 'images', refType: 'image', refId: 'a', additive: false },
    )
    state = assetTreeMultiSelectReducer(state, {
      type: 'click',
      category: 'images',
      refType: 'image',
      refId: 'b',
      additive: true,
    })
    expect([...state.selectedKeys].sort()).toEqual(
      [virtualAssetRefKey('image', 'a'), virtualAssetRefKey('image', 'b')].sort(),
    )
    state = assetTreeMultiSelectReducer(state, {
      type: 'click',
      category: 'images',
      refType: 'image',
      refId: 'a',
      additive: true,
    })
    expect([...state.selectedKeys]).toEqual([virtualAssetRefKey('image', 'b')])
  })

  it('resets when additive click starts in another category', () => {
    const state = assetTreeMultiSelectReducer(
      { activeCategory: 'images', selectedKeys: new Set([virtualAssetRefKey('image', 'a')]) },
      { type: 'click', category: 'audio', refType: 'audio', refId: 's1', additive: true },
    )
    expect(state.activeCategory).toBe('audio')
    expect([...state.selectedKeys]).toEqual([virtualAssetRefKey('audio', 's1')])
  })
})
