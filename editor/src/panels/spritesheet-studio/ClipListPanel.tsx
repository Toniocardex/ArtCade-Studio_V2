import { Plus, Trash2 } from 'lucide-react'
import type { ImageAsset } from '../../types'
import { ExplorerLabelCta } from '../../components/project-explorer/explorer-cta'
import { useEditorSelector } from '../../store/editor-store'
import { validateClipDraft } from '../../utils/spritesheet-clip-draft'
import { findDuplicateClipNameAcrossAssets } from '../../utils/spritesheet-clip-names'
import { ClipComposerPanel } from './ClipComposerPanel'
import { ClipPreviewPane } from './ClipPreviewPane'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'

type ClipListPanelProps = Readonly<{
  asset: ImageAsset
  assetId: string
  session: SpritesheetStudioSession
}>

export function ClipListPanel({ asset, assetId, session }: ClipListPanelProps) {
  const project = useEditorSelector((s) => s.project)
  const {
    clips,
    activeClipIndex,
    setActiveClipIndex,
    activeClip,
    draftClip,
    rangeUi,
    setRange,
    patchActiveClip,
    patchDraft,
    addClip,
    saveDraft,
    cancelDraft,
    removeActiveClip,
    grid,
  } = session

  const duplicateOnAsset =
    project && activeClip?.name
      ? findDuplicateClipNameAcrossAssets(project, activeClip.name, assetId)
      : null
  const duplicateDraftOnAsset =
    project && draftClip?.name
      ? findDuplicateClipNameAcrossAssets(project, draftClip.name, assetId)
      : null
  const draftValidation = validateClipDraft(draftClip, clips, duplicateDraftOnAsset)

  return (
    <div
      className="flex flex-col min-h-0 border-l border-[var(--border)] min-w-[220px] max-w-[300px] w-[min(28vw,300px)] shrink-0"
      data-testid="spritesheet-clips-column"
    >
      <div className="flex flex-col gap-3 p-3 flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Clips</p>
          {clips.length > 0 && !draftClip ? (
            <ExplorerLabelCta
              label="New animation"
              title="Create a new animation from selected frames"
              onClick={addClip}
              tone="primary"
              icon={<Plus size={11} aria-hidden />}
            />
          ) : null}
        </div>

        {clips.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {clips.map((c, i) => (
              <button
                key={`${c.name}-${i}`}
                type="button"
                onClick={() => setActiveClipIndex(i)}
                className={`px-2 py-0.5 rounded text-[10px] border truncate max-w-full ${
                  i === activeClipIndex && !draftClip
                    ? 'border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.18)] text-[var(--text)]'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
                title={`${c.frames.length} frames / ${c.fps} FPS${c.loop ? ' / Loop' : ''}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : draftClip ? null : (
          <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-3 text-[10px]">
            <p className="text-[var(--text)] font-medium">No animations yet</p>
            <p className="mt-1 text-[var(--muted)] leading-snug">
              Select frames on the sheet to create an animation.
            </p>
          </div>
        )}

        {draftClip ? (
          <ClipComposerPanel
            draftClip={draftClip}
            validation={draftValidation}
            onPatchDraft={patchDraft}
            onSave={() => {
              if (draftValidation.canSave) saveDraft()
            }}
            onCancel={cancelDraft}
          />
        ) : null}

      {!draftClip && activeClip ? (
        <div className="space-y-2 text-[10px]">
          <label className="block text-[var(--muted)]">
            Name
            <input
              className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
              value={activeClip.name}
              onChange={(e) =>
                patchActiveClip({ name: e.target.value }, `clip-name:${activeClipIndex}`)
              }
            />
          </label>
          {duplicateOnAsset ? (
            <p className="text-[9px] text-[var(--warn)]">
              Clip name &quot;{activeClip.name}&quot; is already used on &quot;{duplicateOnAsset}&quot;.
              Runtime uses one global name — rename to avoid conflicts.
            </p>
          ) : null}
          <label className="block text-[var(--muted)]">
            FPS
            <input
              type="number"
              min={1}
              className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
              value={activeClip.fps}
              onChange={(e) =>
                patchActiveClip(
                  { fps: Math.max(1, Number.parseFloat(e.target.value) || 12) },
                  `clip-fps:${activeClipIndex}`,
                )
              }
            />
          </label>
          <label className="flex items-center gap-2 text-[var(--muted)]">
            <input
              type="checkbox"
              checked={activeClip.loop}
              onChange={(e) => patchActiveClip({ loop: e.target.checked })}
            />
            Loop
          </label>

          <div className="pt-1 border-t border-[var(--border)]">
            <p className="text-[var(--muted)] mb-1">Frame range</p>
            <div className="flex gap-2 items-center">
              <label className="text-[var(--muted)] flex-1">
                Start
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, grid.totalFrames - 1)}
                  disabled={grid.totalFrames === 0 || (rangeUi != null && !rangeUi.contiguous)}
                  title={
                    rangeUi != null && !rangeUi.contiguous
                      ? 'Selection is not a contiguous range; use the grid or set start/end to replace frames.'
                      : undefined
                  }
                  className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
                  value={rangeUi?.start ?? 0}
                  onChange={(e) => {
                    const start = Number.parseInt(e.target.value, 10)
                    const end = rangeUi?.end ?? start
                    if (!Number.isNaN(start)) setRange(start, end)
                  }}
                />
              </label>
              <label className="text-[var(--muted)] flex-1">
                End
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, grid.totalFrames - 1)}
                  disabled={grid.totalFrames === 0 || (rangeUi != null && !rangeUi.contiguous)}
                  title={
                    rangeUi != null && !rangeUi.contiguous
                      ? 'Selection is not a contiguous range; use the grid or set start/end to replace frames.'
                      : undefined
                  }
                  className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
                  value={rangeUi?.end ?? 0}
                  onChange={(e) => {
                    const end = Number.parseInt(e.target.value, 10)
                    const start = rangeUi?.start ?? 0
                    if (!Number.isNaN(end)) setRange(start, end)
                  }}
                />
              </label>
            </div>
            {rangeUi && !rangeUi.contiguous ? (
              <p className="text-[9px] text-[var(--warn)] mt-1">
                Selection is not a contiguous range. Use the grid or set start/end to replace frames.
              </p>
            ) : null}
            <p className="text-[9px] text-[var(--muted)] mt-1">
              {activeClip.frames.length} frame{activeClip.frames.length === 1 ? '' : 's'} selected
            </p>
          </div>

          <button
            type="button"
            className="text-[var(--danger)] flex items-center gap-1"
            onClick={removeActiveClip}
          >
            <Trash2 size={11} /> Remove clip
          </button>
        </div>
      ) : null}
      </div>
      <ClipPreviewPane asset={asset} session={session} />
    </div>
  )
}
