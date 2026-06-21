import type { AnimationClipDef } from '../../types'
import type { ClipDraftValidation } from '../../utils/spritesheet-clip-draft'

type ClipComposerPanelProps = Readonly<{
  draftClip: AnimationClipDef
  validation: ClipDraftValidation
  onPatchDraft: (patch: Partial<AnimationClipDef>) => void
  onSave: () => void
  onCancel: () => void
}>

export function ClipComposerPanel({
  draftClip,
  validation,
  onPatchDraft,
  onSave,
  onCancel,
}: ClipComposerPanelProps) {
  return (
    <div
      className="rounded border border-[var(--accent-bd)] bg-[rgb(var(--accent-rgb)/0.08)] p-3 space-y-3 text-[10px]"
      data-testid="spritesheet-draft-composer"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--accent)]">
            New animation draft
          </p>
          <p className="text-[9px] text-[var(--muted)] mt-1">
            {draftClip.frames.length} frame{draftClip.frames.length === 1 ? '' : 's'} selected
          </p>
        </div>
        <span className="rounded border border-[var(--accent-bd)] px-1.5 py-0.5 text-[8px] text-[var(--accent)]">
          Draft
        </span>
      </div>

      <label className="block text-[var(--muted)]">
        Name
        <input
          className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1 text-[var(--text)]"
          value={draftClip.name}
          onChange={(e) => onPatchDraft({ name: e.target.value })}
        />
      </label>

      <label className="block text-[var(--muted)]">
        FPS
        <input
          type="number"
          min={1}
          className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1 text-[var(--text)]"
          value={draftClip.fps}
          onChange={(e) =>
            onPatchDraft({ fps: Math.max(1, Number.parseFloat(e.target.value) || 12) })
          }
        />
      </label>

      <label className="flex items-center gap-2 text-[var(--muted)]">
        <input
          type="checkbox"
          checked={draftClip.loop}
          onChange={(e) => onPatchDraft({ loop: e.target.checked })}
        />
        Loop
      </label>

      {validation.message ? (
        <p className={`text-[9px] ${validation.canSave ? 'text-[var(--muted)]' : 'text-[var(--warn)]'}`}>
          {validation.message}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className="text-[10px] px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-2)]"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="text-[10px] px-2 py-1 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)] disabled:opacity-40 disabled:hover:bg-[var(--accent-bg)]"
          disabled={!validation.canSave}
          onClick={onSave}
        >
          Save animation
        </button>
      </div>
    </div>
  )
}
