// ---------------------------------------------------------------------------
// RuntimeStatusBadge — top-right "RUNTIME READY / LOADING / NO PROJECT"
// ---------------------------------------------------------------------------

import { Wifi, WifiOff } from 'lucide-react'

interface RuntimeStatusBadgeProps {
  wasmReady:  boolean
  hasProject: boolean
}

export function RuntimeStatusBadge({ wasmReady, hasProject }: RuntimeStatusBadgeProps) {
  return (
    <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5
                    bg-[var(--panel)] px-2 py-1 rounded-lg border border-[var(--border)] shadow-lg text-[9px]">
      {wasmReady
        ? (
          <>
            <Wifi size={10} className="text-[var(--accent)]" />
            <span className="text-[var(--accent)]">RUNTIME READY</span>
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
