export interface BootLoadingOverlayProps {
  statusLine: string
  timedOut: boolean
  onRetry?: () => void
}

export function BootLoadingOverlay({ statusLine, timedOut, onRetry }: BootLoadingOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6
                 bg-[var(--bg)] text-[var(--text)] select-none"
      role="status"
      aria-live="polite"
      aria-busy={!timedOut}
    >
      <div className="flex flex-col items-center gap-3 px-6 max-w-sm text-center">
        <p className="text-lg font-bold tracking-tight text-[var(--text)]">
          ArtCade Studio
        </p>
        {!timedOut ? (
          <>
            <div
              className="w-8 h-8 rounded-full border-2 border-[var(--border-2)] border-t-[var(--accent)]
                         animate-spin"
              aria-hidden
            />
            <p className="text-[11px] text-[var(--muted)] font-mono">{statusLine}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] text-[var(--danger)] font-mono leading-snug">
              Startup timed out. Check the console for runtime errors, then retry.
            </p>
            <p className="text-[10px] text-[var(--muted)]">{statusLine}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 px-4 py-1.5 rounded text-xs font-semibold border border-[var(--accent-bd)]
                           bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
