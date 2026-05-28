import type { DialogCommand } from '../../utils/dialog/dialog-script'

type ShowTextCommand = Extract<DialogCommand, { type: 'showText' }>

type DialogMessagePreviewProps = Readonly<{
  commands: DialogCommand[]
  focusIndex: number | null
}>

function isShowTextCommand(cmd: DialogCommand | undefined): cmd is ShowTextCommand {
  return cmd?.type === 'showText'
}

function pickShowTextPreview(
  commands: DialogCommand[],
  focusIndex: number | null,
): ShowTextCommand | null {
  if (focusIndex != null && focusIndex >= 0 && focusIndex < commands.length) {
    const focused = commands[focusIndex]
    if (isShowTextCommand(focused)) return focused
  }
  const first = commands.find((c): c is ShowTextCommand => c.type === 'showText')
  return first ?? null
}

export function DialogMessagePreview({ commands, focusIndex }: DialogMessagePreviewProps) {
  const show = pickShowTextPreview(commands, focusIndex)

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
            <p className="text-sm font-semibold text-[var(--accent)] mb-1">{show.character}</p>
          ) : null}
          <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">
            {show.text || '…'}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--muted)]">Select a Show Text command to preview.</p>
      )}
    </div>
  )
}
