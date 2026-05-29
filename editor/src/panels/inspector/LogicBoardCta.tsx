import { Workflow } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { InspectorSection } from './inspector-fields'
import { openLogicBoardForEntity } from './logic-board-navigation'

export type LogicBoardCtaProps = Readonly<{
  entity: EntityDef
}>

export function LogicBoardCta({ entity }: LogicBoardCtaProps) {
  const { dispatch } = useEditor()

  return (
    <InspectorSection label="Scripts & rules" defaultOpen>
      {entity.scriptPath ? (
        <p className="text-[10px] text-[var(--muted)] mb-2 leading-snug truncate" title={entity.scriptPath}>
          Attached script: {entity.scriptPath}
        </p>
      ) : (
        <p className="text-[10px] text-[var(--muted)] mb-2 leading-snug italic">
          No per-entity script — gameplay rules live on the Logic Board.
        </p>
      )}
      <button
        type="button"
        onClick={() => openLogicBoardForEntity(dispatch, entity.id)}
        aria-label={`Open Logic Board for ${entity.name}`}
        className="w-full flex flex-col items-center justify-center gap-1.5 py-3 px-4 rounded
                   bg-[var(--accent)] text-[var(--bg)] font-extrabold text-xs tracking-wide
                   shadow-[0_4px_14px_rgb(var(--accent-rgb)/0.35)]
                   hover:brightness-110 active:translate-y-px transition-all"
      >
        <span>OPEN LOGIC BOARD</span>
        <Workflow size={22} strokeWidth={2.5} aria-hidden />
      </button>
    </InspectorSection>
  )
}
