export function LogicBoardCompileErrorBanner({
  error,
  title = 'Logic Board compile failed',
  hint = 'Fix incompatible triggers or actions in your rules, then try again.',
}: {
  error: string
  title?: string
  hint?: string
}) {
  return (
    <div
      role="alert"
      className="flex-shrink-0 px-4 py-2 border-b border-[var(--pill-then-bd)] bg-[var(--pill-then-bg)] text-xs text-[var(--text)]"
    >
      <p className="text-[var(--warn)] font-semibold mb-1">{title}</p>
      <p className="text-[10px] leading-snug text-[var(--muted)] whitespace-pre-wrap font-mono">
        {error}
      </p>
      {hint ? (
        <p className="text-[10px] text-[var(--muted)] mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
}
