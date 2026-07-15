import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import type { AssetDragRef } from '../utils/asset-explorer-dnd'
import { useEditorSelector } from '../store/editor-store'
import {
  parseVirtualAssetRefKey,
  virtualAssetRefKey,
  type AssetVirtualFolderCategory,
  type VirtualAssetRefType,
} from '../utils/asset-virtual-folders'

export type AssetTreeMultiSelectState = Readonly<{
  activeCategory: AssetVirtualFolderCategory | null
  selectedKeys: ReadonlySet<string>
}>

export function assetTreeMultiSelectReducer(
  state: AssetTreeMultiSelectState,
  action:
    | { type: 'clear' }
    | {
        type: 'click'
        category: AssetVirtualFolderCategory
        refType: VirtualAssetRefType
        refId: string
        additive: boolean
      },
): AssetTreeMultiSelectState {
  if (action.type === 'clear') {
    return { activeCategory: null, selectedKeys: new Set() }
  }

  const key = virtualAssetRefKey(action.refType, action.refId)

  if (action.additive) {
    const sameCategory = state.activeCategory === action.category
    const next = new Set(sameCategory ? state.selectedKeys : [])
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return { activeCategory: action.category, selectedKeys: next }
  }

  return {
    activeCategory: action.category,
    selectedKeys: new Set([key]),
  }
}

/**
 * Explorer asset tree multi-select (Ctrl/Cmd+click). Scoped to one library category at a time.
 * Highlight falls back to store `inspectorAsset` when the multi set is empty — one visual SoT.
 * Cleared when an entity is selected so canvas selection cannot leave stale asset highlights.
 */
export function useAssetTreeMultiSelect() {
  const [state, setState] = useState<AssetTreeMultiSelectState>({
    activeCategory: null,
    selectedKeys: new Set(),
  })
  const inspectorAsset = useEditorSelector((s) => s.inspectorAsset)
  const selectionEntityId = useEditorSelector((s) => s.selection.entityId)

  const clearMulti = useCallback(() => {
    setState({ activeCategory: null, selectedKeys: new Set() })
  }, [])

  useEffect(() => {
    if (selectionEntityId != null) clearMulti()
  }, [selectionEntityId, clearMulti])

  const isSelected = useCallback(
    (type: VirtualAssetRefType, id: string) => {
      const key = virtualAssetRefKey(type, id)
      if (state.selectedKeys.size > 0) return state.selectedKeys.has(key)
      return inspectorAsset?.type === type && inspectorAsset.id === id
    },
    [state.selectedKeys, inspectorAsset],
  )

  const handleAssetClick = useCallback(
    (
      e: MouseEvent,
      category: AssetVirtualFolderCategory,
      type: VirtualAssetRefType,
      id: string,
      onActivate: () => void,
    ) => {
      const additive = e.ctrlKey || e.metaKey
      setState((prev) =>
        assetTreeMultiSelectReducer(prev, {
          type: 'click',
          category,
          refType: type,
          refId: id,
          additive,
        }),
      )
      onActivate()
    },
    [],
  )

  const dragRefsFor = useCallback(
    (
      category: AssetVirtualFolderCategory,
      type: VirtualAssetRefType,
      id: string,
    ): readonly AssetDragRef[] => {
      const key = virtualAssetRefKey(type, id)
      if (
        state.activeCategory !== category
        || state.selectedKeys.size <= 1
        || !state.selectedKeys.has(key)
      ) {
        return [{ type, id }]
      }
      const refs: AssetDragRef[] = []
      for (const selectedKey of state.selectedKeys) {
        const ref = parseVirtualAssetRefKey(selectedKey)
        if (ref) refs.push(ref)
      }
      return refs.length > 0 ? refs : [{ type, id }]
    },
    [state.activeCategory, state.selectedKeys],
  )

  const batchRefsInCategory = useCallback(
    (category: AssetVirtualFolderCategory): readonly AssetDragRef[] => {
      if (state.activeCategory !== category || state.selectedKeys.size <= 1) return []
      const refs: AssetDragRef[] = []
      for (const selectedKey of state.selectedKeys) {
        const ref = parseVirtualAssetRefKey(selectedKey)
        if (ref) refs.push(ref)
      }
      return refs
    },
    [state.activeCategory, state.selectedKeys],
  )

  const selectedRefs = useCallback((): readonly AssetDragRef[] => {
    if (state.selectedKeys.size === 0) return []
    const refs: AssetDragRef[] = []
    for (const selectedKey of state.selectedKeys) {
      const ref = parseVirtualAssetRefKey(selectedKey)
      if (ref) refs.push(ref)
    }
    return refs
  }, [state.selectedKeys])

  return {
    isSelected,
    handleAssetClick,
    dragRefsFor,
    batchRefsInCategory,
    selectedRefs,
    clearMulti,
    selectionCount: state.selectedKeys.size,
  }
}
