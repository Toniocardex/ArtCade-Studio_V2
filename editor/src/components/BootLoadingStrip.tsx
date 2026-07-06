/** Status line + indeterminate bar shown during editor boot. */
export function BootLoadingStrip({
  statusLine,
  diagnosticHints = [],
  visible,
}: Readonly<{
  statusLine: string
  diagnosticHints?: string[]
  visible: boolean
}>) {
  if (!visible) return null

  return (
    <div
      className="fixed bottom-20 left-0 right-0 z-[105] flex flex-col items-center gap-3 px-6 pointer-events-none"
      aria-hidden={!visible}
    >
      <p className="text-[10px] text-[var(--muted)] font-mono text-center max-w-md leading-snug">
        {statusLine}
      </p>
      {diagnosticHints.length > 0 && (
        <div className="flex flex-col gap-1 max-w-lg w-full">
          {diagnosticHints.map((hint) => (
            <p
              key={hint}
              className="text-[9px] text-[var(--danger)] font-mono text-center leading-snug break-words"
            >
              {hint}
            </p>
          ))}
        </div>
      )}
      <div
        className="w-full max-w-xs h-1 rounded-sm bg-[var(--border)] overflow-hidden"
        role="progressbar"
        aria-label="Loading"
      >
        <div className="h-full w-2/5 rounded-sm bg-[var(--accent)] animate-boot-bar" />
      </div>
    </div>
  )
}
