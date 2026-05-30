import { useMemo } from 'react'
import { useEditor } from '../../../store/editor-store'
import { openSpritesheetStudio } from '../../../panels/spritesheet-studio/openSpritesheetStudio'

/** Read-only clip summary + link to Spritesheet Studio for the selected entity sprite. */
export function AnimationTimelineTab() {
  const { state, dispatch } = useEditor()
  const project = state.project
  const entityId = state.selection.entityId

  const summary = useMemo(() => {
    if (!project || entityId == null) {
      return { lines: ['Select an entity with a sprite to see animation clips.'], spriteId: null as string | null }
    }
    const entity = project.entities[entityId]
    const spriteId = entity?.sprite?.spriteAssetId
    if (!spriteId) {
      return { lines: ['Selected entity has no sprite assigned.'], spriteId: null }
    }
    const asset = project.assets?.[spriteId]
    const clips = asset?.clips ?? []
    if (clips.length === 0) {
      return {
        lines: [`${asset?.name ?? spriteId}: no clips defined yet.`],
        spriteId,
      }
    }
    return {
      lines: clips.map((c, i) => `${String(i + 1).padStart(2, '0')}. ${c.name} (${c.frames.length} frames @ ${c.fps} fps)`),
      spriteId,
    }
  }, [project, entityId])

  return (
    <div className="h-full flex flex-col p-3 text-[10px] text-[var(--primary-soft)]">
      <p className="text-[9px] uppercase tracking-wide text-[var(--muted)] mb-2">Animation Timeline</p>
      <div className="flex-1 overflow-auto font-mono space-y-0.5">
        {summary.lines.map((line) => (
          <div key={line} className="py-0.5 border-b border-[var(--outline-faint)]">
            {line}
          </div>
        ))}
      </div>
      {summary.spriteId && project && (
        <button
          type="button"
          className="mt-2 shrink-0 text-[10px] px-2 py-1.5 rounded-[var(--radius)] border border-[var(--outline)] text-[var(--accent)] hover:bg-[var(--outline-faint)]"
          onClick={() => openSpritesheetStudio(dispatch, project, summary.spriteId!)}
        >
          Open Spritesheet Studio…
        </button>
      )}
      <p className="mt-2 text-[9px] text-[var(--muted)]">
        Full timeline editing is planned; use Spritesheet Studio to author clips today.
      </p>
    </div>
  )
}
