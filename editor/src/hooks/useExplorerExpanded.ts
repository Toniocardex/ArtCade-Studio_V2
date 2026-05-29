import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'artcade.explorer.expanded.v1'

export type ExplorerExpandKey =
  | 'scenes'
  | 'entities'
  | 'entityTypes'
  | 'assets'
  | `asset:${string}`

type ExpandedMap = Record<string, boolean>

const DEFAULT_EXPANDED: ExpandedMap = {
  scenes: true,
  entities: true,
  entityTypes: false,
  assets: false,
  'asset:audio': true,
  'asset:fonts': true,
  'asset:images': true,
  'asset:scripts': false,
  'asset:tilesets': true,
}

function readExpanded(): ExpandedMap {
  if (globalThis.window === undefined) return { ...DEFAULT_EXPANDED }
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_EXPANDED }
    const parsed = JSON.parse(raw) as ExpandedMap
    return { ...DEFAULT_EXPANDED, ...parsed }
  } catch {
    return { ...DEFAULT_EXPANDED }
  }
}

function writeExpanded(map: ExpandedMap): void {
  if (globalThis.window === undefined) return
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function useExplorerExpanded() {
  const [expanded, setExpanded] = useState<ExpandedMap>(readExpanded)

  useEffect(() => {
    writeExpanded(expanded)
  }, [expanded])

  const isOpen = useCallback(
    (key: ExplorerExpandKey) => expanded[key] !== false,
    [expanded],
  )

  const toggle = useCallback((key: ExplorerExpandKey) => {
    setExpanded((prev) => {
      const open = prev[key] !== false
      return { ...prev, [key]: !open }
    })
  }, [])

  const setOpen = useCallback((key: ExplorerExpandKey, open: boolean) => {
    setExpanded((prev) => ({ ...prev, [key]: open }))
  }, [])

  const expandAllAssetFolders = useCallback(() => {
    setExpanded((prev) => ({
      ...prev,
      assets: true,
      'asset:audio': true,
      'asset:fonts': true,
      'asset:images': true,
      'asset:scripts': true,
      'asset:tilesets': true,
    }))
  }, [])

  return { isOpen, toggle, setOpen, expandAllAssetFolders }
}
