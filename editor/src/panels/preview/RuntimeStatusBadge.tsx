// ---------------------------------------------------------------------------
// RuntimeStatusBadge — "RUNTIME READY / LOADING / NO PROJECT" pill
// ---------------------------------------------------------------------------
//
// Rendered inside the CanvasToolbar's right slot, so it sits in the header
// strip above the canvas (never overlapping it).

import { Wifi, WifiOff } from 'lucide-react'

interface RuntimeStatusBadgeProps {
  wasmReady:  boolean
  hasProject: boolean
  /** Shorter label when toolbar shares space with Inspector toggle (compact tier). */
  compact?: boolean
}

export function RuntimeStatusBadge({ wasmReady, hasProject, compact = false }: RuntimeStatusBadgeProps) {
  const readyLabel = compact ? 'READY' : 'RUNTIME READY'
  const loadingLabel = compact ? '…' : (hasProject ? 'LOADING…' : 'NO PROJECT')

  return (
    <div
      className="flex items-center gap-1.5 shrink min-w-0
                 bg-[var(--bg)] px-2 py-1 rounded border border-[var(--border-2)]
                 text-[9px] font-semibold tracking-wider uppercase"
      title={wasmReady ? 'Runtime ready' : (hasProject ? 'Runtime loading' : 'No project loaded')}
    >
      {wasmReady
        ? (
          <>
            <Wifi size={10} className="shrink-0 text-[var(--accent)]" />
            <span className="text-[var(--text)] truncate">{readyLabel}</span>
          </>
        )
        : (
          <>
            <WifiOff size={10} className="shrink-0 text-[var(--muted)]" />
            <span className="text-[var(--muted)] truncate">
              {hasProject ? loadingLabel : (compact ? 'NO PRJ' : 'NO PROJECT')}
            </span>
          </>
        )}
    </div>
  )
}
