import type { DialogCommand } from '../../utils/dialog/dialog-script'

export function DialogMessagePreview({
  commands,
  focusIndex,
}: {
  commands: DialogCommand[]
  focusIndex: number | null
}) {
  const cmd =
    focusIndex != null && focusIndex >= 0 && focusIndex < commands.length
      ? commands[focusIndex]
      : null
  const show =
    cmd?.type === 'showText'
      ? cmd
      : commands.find((c) => c.type === 'showText')?.type === 'showText'
        ? (commands.find((c) => c.type === 'showText') as Extract<
            DialogCommand,
            { type: 'showText' }
          >)
        : null

  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[rgb(0,0,0,0.45)] p-3 min-h-[88px]"
      aria-label="Message preview"
    >
      <p className="text-[10px] text-[var(--muted)] mb-2 uppercase tracking-wide">
        Preview
      </p>
      {show ? (
        <>
          {show.character ? (
            <p className="text-sm font-semibold text-[#FFD700] mb-1">{show.character}</p>
          ) : null}
          <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
            {show.text || '…'}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--muted)]">Select a Show Text command to preview.</p>
      )}
    </div>
  )
}
