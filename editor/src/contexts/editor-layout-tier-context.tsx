import { createContext, useContext, type ReactNode, type RefObject } from 'react'
import { useWorkspaceLayoutMetrics, type WorkspaceLayoutMetrics } from '../hooks/useWorkspaceLayoutMetrics'
import type { LayoutTier } from '../utils/editor-layout-tier'

const WorkspaceLayoutContext = createContext<WorkspaceLayoutMetrics | null>(null)

export function EditorLayoutTierProvider({
  workspaceRef,
  children,
}: Readonly<{
  workspaceRef: RefObject<HTMLElement | null>
  children: ReactNode
}>) {
  const metrics = useWorkspaceLayoutMetrics(workspaceRef)
  return (
    <WorkspaceLayoutContext.Provider value={metrics}>
      {children}
    </WorkspaceLayoutContext.Provider>
  )
}

export function useLayoutTier(): LayoutTier {
  const ctx = useWorkspaceLayoutMetricsContext()
  return ctx.tier
}

export function useWorkspaceLayoutMetricsContext(): WorkspaceLayoutMetrics {
  const ctx = useContext(WorkspaceLayoutContext)
  if (!ctx) {
    throw new Error('useWorkspaceLayoutMetricsContext requires EditorLayoutTierProvider')
  }
  return ctx
}
