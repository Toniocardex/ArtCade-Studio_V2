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
}

export function RuntimeStatusBadge({ wasmReady, hasProject }: RuntimeStatusBadgeProps) {
  return (
    <div className="flex items-center gap-1.5
                    bg-[var(--bg)] px-2 py-1 rounded border border-[var(--border-2)]
                    text-[9px] font-semibold tracking-wider uppercase">
      {wasmReady
        ? (
          <>
            <Wifi size={10} className="text-[var(--accent)]" />
            <span className="text-[var(--text)]">RUNTIME READY</span>
          </>
        )
        : (
          <>
            <WifiOff size={10} className="text-[var(--muted)]" />
            <span className="text-[var(--muted)]">
              {hasProject ? 'LOADING…' : 'NO PROJECT'}
            </span>
          </>
        )}
    </div>
  )
}
