import { useMemo } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../../store/editor-store'
import { openSpritesheetStudio } from '../../../panels/spritesheet-studio/openSpritesheetStudio'

/** Read-only clip summary + mockup filmstrip chrome. */
export function AnimationTimelineTab() {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const entityId = useEditorSelector((s) => s.selection.entityId)

  const summary = useMemo(() => {
    if (!project || entityId == null) {
      return { clipName: null as string | null, frames: 0, fps: 10, spriteId: null as string | null }
    }
    const entity = project.entities[entityId]
    const spriteId = entity?.sprite?.spriteAssetId
    if (!spriteId) {
      return { clipName: null, frames: 0, fps: 10, spriteId: null }
    }
    const asset = project.assets?.[spriteId]
    const clip = asset?.clips?.[0]
    return {
      clipName: clip?.name ?? null,
      frames: clip?.frames.length ?? 0,
      fps: clip?.fps ?? 10,
      spriteId,
    }
  }, [project, entityId])

  const frameCells = Math.max(6, Math.min(12, summary.frames || 8))

  return (
    <div className="h-full flex flex-col p-2 text-[9px] text-[var(--primary-soft)]">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-semibold text-[var(--primary)] truncate">
          {summary.clipName ?? 'No clip'}
        </span>
        <span className="text-[var(--muted)] font-mono shrink-0">{summary.fps} fps</span>
      </div>

      <div className="flex items-center gap-1 mb-2 text-[var(--muted)]">
        <button type="button" className="p-0.5 hover:text-[var(--primary)]" aria-label="Previous frame">
          <SkipBack size={12} />
        </button>
        <button type="button" className="p-0.5 hover:text-[var(--primary)]" aria-label="Play">
          <Play size={12} />
        </button>
        <button type="button" className="p-0.5 hover:text-[var(--primary)]" aria-label="Pause">
          <Pause size={12} />
        </button>
        <button type="button" className="p-0.5 hover:text-[var(--primary)]" aria-label="Next frame">
          <SkipForward size={12} />
        </button>
      </div>

      <div className="flex gap-0.5 overflow-x-auto pb-1 mb-2 border-b border-[var(--outline-faint)]">
        {Array.from({ length: frameCells }, (_, i) => (
          <div
            key={i}
            className={`shrink-0 w-8 h-8 border rounded-sm ${
              i === 0
                ? 'border-[var(--outline-focus)] bg-[var(--surface-selected)]'
                : 'border-[var(--outline)] bg-[var(--surface)]'
            }`}
            title={`Frame ${i + 1}`}
          />
        ))}
      </div>

      {!summary.spriteId && (
        <p className="text-[var(--muted)] leading-snug flex-1">
          Select an entity with a sprite to preview clips.
        </p>
      )}

      {summary.spriteId && project && (
        <button
          type="button"
          className="mt-auto shrink-0 w-full text-[9px] px-2 py-1 rounded-[var(--radius)] border border-[var(--outline)] text-[var(--accent)] hover:bg-[var(--surface-hover)]"
          onClick={() => openSpritesheetStudio(dispatch, project, summary.spriteId!)}
        >
          Open Spritesheet Studio…
        </button>
      )}
    </div>
  )
}
