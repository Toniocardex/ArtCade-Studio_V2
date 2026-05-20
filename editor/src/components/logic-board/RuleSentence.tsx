// ---------------------------------------------------------------------------
// Readable one-line rule headline (collapsed card)
// ---------------------------------------------------------------------------

export function RuleSentence({
  text,
  dimmed,
}: {
  text: string
  dimmed?: boolean
}) {
  return (
    <span
      className={`text-sm leading-snug ${dimmed ? 'text-[var(--muted)]' : 'text-[var(--text)]'}`}
    >
      {text}
    </span>
  )
}
