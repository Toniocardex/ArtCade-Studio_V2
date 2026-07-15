// ---------------------------------------------------------------------------
// ExplorerExpandedContext — single expand map for the whole left explorer dock
// ---------------------------------------------------------------------------
// Stacked layout mounts separate scene/assets panels; they must share one
// expanded map (and one localStorage writer), not two React states racing.

import { createContext, useContext, type ReactNode } from 'react'
import { useExplorerExpanded } from '../../hooks/useExplorerExpanded'

export type ExplorerExpandedApi = ReturnType<typeof useExplorerExpanded>

const ExplorerExpandedContext = createContext<ExplorerExpandedApi | null>(null)

export function ExplorerExpandedProvider({ children }: Readonly<{ children: ReactNode }>) {
  const api = useExplorerExpanded()
  return (
    <ExplorerExpandedContext.Provider value={api}>
      {children}
    </ExplorerExpandedContext.Provider>
  )
}

/**
 * Shared expand API from ExplorerShell (or a local provider wrapper).
 * Throws if called outside a provider — never create a second map silently.
 */
export function useSharedExplorerExpanded(): ExplorerExpandedApi {
  const shared = useContext(ExplorerExpandedContext)
  if (!shared) {
    throw new Error('useSharedExplorerExpanded requires ExplorerExpandedProvider')
  }
  return shared
}

export function useExplorerExpandedContextOptional(): ExplorerExpandedApi | null {
  return useContext(ExplorerExpandedContext)
}
