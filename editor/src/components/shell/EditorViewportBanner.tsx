import { EDITOR_LAYOUT_MIN_WIDTH_PX } from '../../constants/editor-ui-scale'
import { useWorkspaceLayoutMetricsContext } from '../../contexts/editor-layout-tier-context'

function bannerMessage(
  tier: ReturnType<typeof useWorkspaceLayoutMetricsContext>['tier'],
  width: number,
): string | null {
  if (tier === 'unsupported') {
    return 'Resolution not supported — use at least 1024×600 (1366×768 recommended).'
  }
  if (tier === 'minimal') {
    return 'Low resolution — some features may be hard to use. Recommended minimum: 1366×768.'
  }
  if (tier === 'compact' && width < EDITOR_LAYOUT_MIN_WIDTH_PX) {
    return `Narrow window — layout is optimized for ${EDITOR_LAYOUT_MIN_WIDTH_PX}px width or wider.`
  }
  return null
}

/** Non-blocking hint when the editor workspace is below recommended size. */
export function EditorViewportBanner() {
  const { tier, width } = useWorkspaceLayoutMetricsContext()
  const message = bannerMessage(tier, width)
  if (!message) return null

  return (
    <div
      className="absolute left-0 right-0 top-[var(--editor-top-chrome-h)] z-20 pointer-events-none
                 px-3 py-0.5 text-center text-[9px] text-[var(--primary-soft)]
                 bg-[var(--surface-2)]/90 border-b border-[var(--outline-subtle)]"
      role="status"
    >
      {message}
    </div>
  )
}
