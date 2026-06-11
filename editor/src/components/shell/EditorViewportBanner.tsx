import { useWorkspaceLayoutMetricsContext } from '../../contexts/editor-layout-tier-context'

/**
 * Last-resort warning, shown only below the hard minimum (1024×600) where the
 * adaptive layout (compact shell, drawer inspector, collapsed dock) can no
 * longer compensate. Compact/minimal tiers adapt silently — no banner.
 */
export function EditorViewportBanner() {
  const { tier } = useWorkspaceLayoutMetricsContext()
  if (tier !== 'unsupported') return null

  return (
    <div
      className="shrink-0 px-3 py-0.5 text-center text-[9px] text-[var(--primary-soft)]
                 bg-[var(--surface-2)] border-b border-[var(--outline-subtle)]"
      role="status"
    >
      Resolution not supported — use at least 1024×600 (1366×768 recommended).
    </div>
  )
}
