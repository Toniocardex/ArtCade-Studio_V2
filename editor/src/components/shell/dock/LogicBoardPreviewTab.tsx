import { useMemo } from 'react'
import { useEditor } from '../../../store/editor-store'
import { findLogicBoardForInstance } from '../../../utils/project'
import { eventTriggerSummaryPlain } from '../../../panels/logic-board/friendly-labels'

/** Read-only summary of logic events for the selected entity (Canvas dock tab). */
export function LogicBoardPreviewTab() {
  const { state } = useEditor()
  const project = state.project
  const entityId = state.selection.entityId

  const lines = useMemo(() => {
    if (!project || entityId == null) {
      return ['Select an entity on the Canvas to preview its rules.']
    }
    const board = findLogicBoardForInstance(project, entityId)
    if (!board || board.events.length === 0) {
      return ['No rulesheet for this entity. Open Logic Board to create rules.']
    }
    return board.events.map(
      (ev, i) =>
        `${String(i + 1).padStart(2, '0')}. ${ev.enabled ? '' : '(off) '}${eventTriggerSummaryPlain(ev, project)}`,
    )
  }, [project, entityId])

  return (
    <div className="h-full overflow-auto p-3 font-mono text-[10px] text-[var(--primary-soft)]">
      {lines.map((line) => (
        <div key={line} className="py-0.5 border-b border-[var(--outline-faint)]">
          {line}
        </div>
      ))}
    </div>
  )
}
