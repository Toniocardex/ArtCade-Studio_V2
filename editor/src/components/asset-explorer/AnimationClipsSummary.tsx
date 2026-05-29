import type { ImageAsset } from '../../types'

type AnimationClipsSummaryProps = Readonly<{
  asset: ImageAsset
  onOpenStudio: () => void
}>

export function AnimationClipsSummary({ asset, onOpenStudio }: AnimationClipsSummaryProps) {
  const clips = asset.clips ?? []
  const clipCount = clips.length
  const frameCount = clips.reduce((n, c) => n + (c.frames?.length ?? 0), 0)

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-2 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Animations</p>
      <p className="text-[10px] text-[var(--text)]">
        {clipCount === 0
          ? 'No animation clips on this sheet.'
          : `${clipCount} clip${clipCount === 1 ? '' : 's'}, ${frameCount} frame${frameCount === 1 ? '' : 's'} total`}
      </p>
      <button
        type="button"
        className="text-[10px] px-2 py-1 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[rgb(var(--accent-rgb)/0.1)]"
        onClick={onOpenStudio}
      >
        Open Spritesheet Studio
      </button>
    </div>
  )
}
