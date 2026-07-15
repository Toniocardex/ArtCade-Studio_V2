import type { ReactNode } from 'react'
import {
  ExplorerExpandedProvider,
  useExplorerExpandedContextOptional,
} from './ExplorerExpandedContext'
import { SceneExplorerHost } from './SceneExplorerHost'
import { AssetsExplorerHost } from './AssetsExplorerHost'
import { CombinedExplorerHost } from './CombinedExplorerHost'

export type ExplorerPane = 'scene' | 'assets' | 'all'

export type ProjectExplorerPanelProps = Readonly<{
  explorerPane?: ExplorerPane
}>

/** Ensure a single expand map even when the panel is mounted outside ExplorerShell. */
function withExplorerExpanded(node: ReactNode): ReactNode {
  return <ExplorerExpandedProvider>{node}</ExplorerExpandedProvider>
}

/**
 * Routes to a dedicated host so stacked scene+assets panes never share the same
 * hook instance (no dual Insert/Delete listeners, no racing expand writers).
 */
export default function ProjectExplorerPanel({ explorerPane = 'all' }: ProjectExplorerPanelProps) {
  const existing = useExplorerExpandedContextOptional()
  const body =
    explorerPane === 'scene' ? (
      <SceneExplorerHost />
    ) : explorerPane === 'assets' ? (
      <AssetsExplorerHost />
    ) : (
      <CombinedExplorerHost />
    )
  return existing ? body : withExplorerExpanded(body)
}
