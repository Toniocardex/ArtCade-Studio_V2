import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'artcade.explorer.expanded.v1'

export type ExplorerExpandKey =
  | 'scenes'
  | 'entities'
  | 'assets'
  | 'dialogs'
  | `asset:${string}`
  | `scene-type:${string}`

type ExpandedMap = Record<string, boolean>

/** Top-level asset library categories in the project explorer tree. */
export const ASSET_LIBRARY_FOLDER_KEYS = [
  'asset:audio',
  'asset:fonts',
  'asset:images',
  'asset:scripts',
  'asset:tilesets',
] as const satisfies readonly ExplorerExpandKey[]

const DEFAULT_EXPANDED: ExpandedMap = {
  scenes: true,
  entities: true,
  assets: false,
  dialogs: true,
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

/** Whether every asset library category folder is expanded (matches tree `isOpen` defaults). */
export function areAllAssetLibraryFoldersExpanded(map: ExpandedMap): boolean {
  return ASSET_LIBRARY_FOLDER_KEYS.every((key) => map[key] ?? true)
}

export function applyExpandAllAssetFolders(prev: ExpandedMap): ExpandedMap {
  return {
    ...prev,
    assets: true,
    'asset:audio': true,
    'asset:fonts': true,
    'asset:images': true,
    'asset:scripts': true,
    'asset:tilesets': true,
  }
}

export function applyCollapseAllAssetFolders(prev: ExpandedMap): ExpandedMap {
  const next = { ...prev }
  for (const key of ASSET_LIBRARY_FOLDER_KEYS) {
    next[key] = false
  }
  for (const key of Object.keys(prev)) {
    if (key.startsWith('asset:vf:')) next[key] = false
  }
  return next
}

export function useExplorerExpanded() {
  const [expanded, setExpanded] = useState<ExpandedMap>(readExpanded)

  useEffect(() => {
    writeExpanded(expanded)
  }, [expanded])

  /**
   * Whether a tree node is expanded. Nodes the user never toggled fall back
   * to `defaultOpen` (sections default open; per-type scene groups pass false
   * to start collapsed).
   */
  const isOpen = useCallback(
    (key: ExplorerExpandKey, defaultOpen = true) => expanded[key] ?? defaultOpen,
    [expanded],
  )

  const toggle = useCallback((key: ExplorerExpandKey, defaultOpen = true) => {
    setExpanded((prev) => {
      const open = prev[key] ?? defaultOpen
      return { ...prev, [key]: !open }
    })
  }, [])

  const setOpen = useCallback((key: ExplorerExpandKey, open: boolean) => {
    setExpanded((prev) => ({ ...prev, [key]: open }))
  }, [])

  const expandAllAssetFolders = useCallback(() => {
    setExpanded(applyExpandAllAssetFolders)
  }, [])

  const collapseAllAssetFolders = useCallback(() => {
    setExpanded(applyCollapseAllAssetFolders)
  }, [])

  const allAssetLibraryFoldersExpanded = useMemo(
    () => areAllAssetLibraryFoldersExpanded(expanded),
    [expanded],
  )

  const toggleAllAssetFolders = useCallback(() => {
    setExpanded((prev) =>
      areAllAssetLibraryFoldersExpanded(prev)
        ? applyCollapseAllAssetFolders(prev)
        : applyExpandAllAssetFolders(prev),
    )
  }, [])

  return {
    isOpen,
    toggle,
    setOpen,
    expandAllAssetFolders,
    collapseAllAssetFolders,
    allAssetLibraryFoldersExpanded,
    toggleAllAssetFolders,
  }
}
