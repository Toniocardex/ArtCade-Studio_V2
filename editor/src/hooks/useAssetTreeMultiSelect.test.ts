/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { assetTreeMultiSelectReducer, useAssetTreeMultiSelect } from './useAssetTreeMultiSelect'

const storeState = {
  inspectorAsset: null as null | { type: 'image'; id: string },
  selection: { entityId: null as number | null },
}

vi.mock('../store/editor-store', () => ({
  useEditorSelector: (sel: (s: typeof storeState) => unknown) => sel(storeState),
}))

afterEach(() => {
  cleanup()
  storeState.inspectorAsset = null
  storeState.selection.entityId = null
  vi.restoreAllMocks()
})

describe('assetTreeMultiSelectReducer', () => {
  it('replaces selection on plain click', () => {
    const next = assetTreeMultiSelectReducer(
      { activeCategory: null, selectedKeys: new Set() },
      { type: 'click', category: 'images', refType: 'image', refId: 'a', additive: false },
    )
    expect([...next.selectedKeys]).toEqual(['image:a'])
  })

  it('toggles within the same category on additive click', () => {
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
    expect(state.selectedKeys.size).toBe(2)
    state = assetTreeMultiSelectReducer(state, {
      type: 'click',
      category: 'images',
      refType: 'image',
      refId: 'a',
      additive: true,
    })
    expect([...state.selectedKeys]).toEqual(['image:b'])
  })

  it('clears on clear action', () => {
    const state = assetTreeMultiSelectReducer(
      { activeCategory: 'images', selectedKeys: new Set(['image:a']) },
      { type: 'clear' },
    )
    expect(state.selectedKeys.size).toBe(0)
    expect(state.activeCategory).toBeNull()
  })
})

describe('useAssetTreeMultiSelect', () => {
  it('falls back highlight to inspectorAsset when multi is empty', () => {
    storeState.inspectorAsset = { type: 'image', id: 'hero' }
    const { result } = renderHook(() => useAssetTreeMultiSelect())
    expect(result.current.isSelected('image', 'hero')).toBe(true)
    expect(result.current.isSelected('image', 'other')).toBe(false)
  })

  it('clears multi when an entity becomes selected', () => {
    const { result, rerender } = renderHook(() => useAssetTreeMultiSelect())
    act(() => {
      result.current.handleAssetClick(
        { ctrlKey: false, metaKey: false } as never,
        'images',
        'image',
        'a',
        () => {},
      )
    })
    expect(result.current.selectionCount).toBe(1)

    storeState.selection.entityId = 7
    rerender()
    expect(result.current.selectionCount).toBe(0)
  })
})
