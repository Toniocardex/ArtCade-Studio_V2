// ---------------------------------------------------------------------------
// RuntimeStatusBadge — WASM / engine / project sync pill
// ---------------------------------------------------------------------------
//
// Rendered inside the CanvasToolbar's right slot, so it sits in the header
// strip above the canvas (never overlapping it).

import { Wifi, WifiOff } from 'lucide-react'

interface RuntimeStatusBadgeProps {
  wasmReady: boolean
  hasProject: boolean
  /** True after editor_load_project returned Ok at least once. */
  projectSynced?: boolean
  /** Shorter label when toolbar shares space with Inspector toggle (compact tier). */
  compact?: boolean
}

export function RuntimeStatusBadge({
  wasmReady,
  hasProject,
  projectSynced = false,
  compact = false,
}: RuntimeStatusBadgeProps) {
  const readyLabel = compact ? 'READY' : 'RUNTIME READY'
  const loadingLabel = compact ? '…' : (hasProject ? 'LOADING…' : 'NO PROJECT')
  const syncSuffix = projectSynced
    ? (compact ? ' · SYNCED' : ' · PROJECT SYNCED')
    : (compact ? ' · NOT SYNCED' : ' · PROJECT NOT SYNCED')

  const title = !wasmReady
    ? (hasProject ? 'Runtime loading' : 'No project loaded')
    : (hasProject
      ? (projectSynced ? 'Runtime ready — project synced' : 'Runtime ready — project not synced')
      : 'Runtime ready')

  return (
    <div
      className="flex items-center gap-1.5 shrink min-w-0
                 bg-[var(--bg)] px-2 py-1 rounded border border-[var(--border-2)]
                 text-[9px] font-semibold tracking-wider uppercase"
      title={title}
    >
      {wasmReady
        ? (
          <>
            <Wifi size={10} className="shrink-0 text-[var(--accent)]" />
            <span className="text-[var(--text)] truncate">
              {readyLabel}
              {hasProject ? syncSuffix : ''}
            </span>
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
