import { Workflow } from 'lucide-react'
import { useEditorDispatch } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { InspectorSection } from './inspector-fields'
import { openLogicBoardForEntity } from './logic-board-navigation'

export type LogicBoardCtaProps = Readonly<{
  entity: EntityDef
}>

export function LogicBoardCta({ entity }: LogicBoardCtaProps) {
  const dispatch = useEditorDispatch()

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
                   bg-[var(--surface-selected)] text-[var(--text-on-selected)] font-extrabold text-xs tracking-wide border border-[var(--outline-focus)]
                   shadow-[0_4px_14px_rgb(var(--accent-rgb)/0.35)]
                   hover:brightness-110 active:translate-y-px transition-all"
      >
        <span>OPEN LOGIC BOARD</span>
        <Workflow size={22} strokeWidth={2.5} aria-hidden />
      </button>
    </InspectorSection>
  )
}
