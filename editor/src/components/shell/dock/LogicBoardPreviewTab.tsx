import { useMemo } from 'react'
import { useEditor } from '../../../store/editor-store'
import { findLogicBoardForInstance } from '../../../utils/project'
import { eventTriggerSummaryPlain } from '../../../panels/logic-board/friendly-labels'
import { LogicBoardPreviewGraph } from './LogicBoardPreviewGraph'

/** Logic preview column: static graph chrome + event list. */
export function LogicBoardPreviewTab() {
  const { state } = useEditor()
  const project = state.project
  const entityId = state.selection.entityId

  const lines = useMemo(() => {
    if (!project || entityId == null) {
      return ['Select an entity to preview rules.']
    }
    const board = findLogicBoardForInstance(project, entityId)
    if (!board || board.events.length === 0) {
      return ['No rulesheet — open Logic Board.']
    }
    return board.events.slice(0, 4).map(
      (ev, i) =>
        `${String(i + 1).padStart(2, '0')}. ${ev.enabled ? '' : '(off) '}${eventTriggerSummaryPlain(ev, project)}`,
    )
  }, [project, entityId])

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 max-h-[45%] min-h-[72px] border-b border-[var(--outline-faint)] overflow-hidden">
        <LogicBoardPreviewGraph />
      </div>
      <div className="flex-1 overflow-auto p-1.5 font-mono text-[9px] text-[var(--primary-soft)]">
        {lines.map((line) => (
          <div key={line} className="py-0.5 border-b border-[var(--outline-faint)] truncate" title={line}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}
