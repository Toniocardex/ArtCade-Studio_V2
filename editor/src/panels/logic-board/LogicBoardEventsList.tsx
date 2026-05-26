import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent, LogicTriggerType } from '../../types/logic-board'
import { TypePicker } from '../../components/logic-board/TypePicker'
import { createLogicEvent } from '../../utils/logic-board/factory'
import { logicBoardLabel } from '../../utils/project'
import EventCard from './EventCard'
import { defaultTrigger } from './options'
import { allowedTriggersForTarget } from '../../utils/logic-board/trigger-compatibility'

interface LogicBoardEventsListProps {
  project: ProjectDoc
  board: LogicBoard | null
  clipboardHint: string | null
  editingId: string | null
  setEditingId: (id: string | null) => void
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  newTrigger: LogicTriggerType
  setNewTrigger: (trigger: LogicTriggerType) => void
  onCloneEvent: (event: LogicEvent) => void
  dispatch: Dispatch<Action>
}

export function LogicBoardEventsList({
  project,
  board,
  clipboardHint,
  editingId,
  setEditingId,
  focusedEventId,
  setFocusedEventId,
  newTrigger,
  setNewTrigger,
  onCloneEvent,
  dispatch,
}: LogicBoardEventsListProps) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      {!board ? (
        <div className="text-[var(--muted)] text-sm mt-8 text-center max-w-md mx-auto leading-relaxed">
          Select an entity in the Scenes panel, then create a rulesheet with{' '}
          <span className="text-[var(--text)]">New rulesheet for selection</span>.
        </div>
      ) : (
        <>
          <div className="text-xs text-[var(--muted)] mb-3 flex items-center gap-2 flex-wrap">
            <span>
              Rules for{' '}
              <span className="text-[var(--text)] font-medium">
                {logicBoardLabel(project, board)}
              </span>{' '}
              ({board.events.length})
            </span>
            {clipboardHint && (
              <span className="text-[10px] text-[var(--accent)]">{clipboardHint}</span>
            )}
            <span className="text-[10px] text-[var(--muted-2)]">
              Ctrl+C copia · Ctrl+V incolla · Ctrl+D clona
            </span>
          </div>

          {board.events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              board={board}
              editing={editingId === ev.id}
              selected={focusedEventId === ev.id}
              onSelect={() => setFocusedEventId(ev.id)}
              onToggleEnabled={() =>
                dispatch({
                  type: 'LOGIC_UPDATE_EVENT',
                  boardId: board.boardId,
                  event: { ...ev, enabled: !ev.enabled },
                })
              }
              onEdit={() => {
                setFocusedEventId(ev.id)
                setEditingId(editingId === ev.id ? null : ev.id)
              }}
              onClone={() => onCloneEvent(ev)}
              onDelete={() => {
                dispatch({
                  type: 'LOGIC_DELETE_EVENT',
                  boardId: board.boardId,
                  eventId: ev.id,
                })
                if (editingId === ev.id) setEditingId(null)
                if (focusedEventId === ev.id) setFocusedEventId(null)
              }}
              onChange={(next) =>
                dispatch({
                  type: 'LOGIC_UPDATE_EVENT',
                  boardId: board.boardId,
                  event: next,
                })
              }
              onDoneEditing={() => setEditingId(null)}
            />
          ))}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <TypePicker
              kind="trigger"
              types={allowedTriggersForTarget(board.target.type)}
              value={newTrigger}
              onChange={(t) => setNewTrigger(t as LogicTriggerType)}
              className="max-w-[240px]"
            />
            <button
              type="button"
              onClick={() => {
                const ev = createLogicEvent(defaultTrigger(newTrigger))
                dispatch({
                  type: 'LOGIC_ADD_EVENT',
                  boardId: board.boardId,
                  event: ev,
                })
                setFocusedEventId(ev.id)
                setEditingId(ev.id)
              }}
              className="flex-1 min-w-[140px] px-3 py-2 rounded border border-dashed border-[var(--border-2)] text-[var(--muted)] text-xs hover:text-[var(--accent)] hover:border-[var(--accent-bd)]"
            >
              Add rule
            </button>
          </div>
        </>
      )}
    </div>
  )
}
