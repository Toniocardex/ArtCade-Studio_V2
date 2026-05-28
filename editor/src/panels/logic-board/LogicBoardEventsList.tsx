import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent, LogicTriggerType } from '../../types/logic-board'
import { TypePicker } from '../../components/logic-board/TypePicker'
import { createLogicEvent } from '../../utils/logic-board/factory'
import {
  logicBoardLabel,
  logicBoardsForScene,
  rulesheetAppliesToLabel,
} from '../../utils/project'
import EventCard from './EventCard'
import { defaultTrigger } from './options'
import { allowedTriggersForTarget } from '../../utils/logic-board/trigger-compatibility'

type LogicBoardEventsListProps = Readonly<{
  project: ProjectDoc
  board: LogicBoard | null
  sceneId: string
  clipboardHint: string | null
  editingId: string | null
  setEditingId: (id: string | null) => void
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  newTrigger: LogicTriggerType
  setNewTrigger: (trigger: LogicTriggerType) => void
  onCloneEvent: (event: LogicEvent, board: LogicBoard) => void
  dispatch: Dispatch<Action>
}>

function renderEventCard(
  ev: LogicEvent,
  eventBoard: LogicBoard,
  props: LogicBoardEventsListProps,
  showAppliesTo: boolean,
) {
  const {
    editingId,
    setEditingId,
    focusedEventId,
    setFocusedEventId,
    onCloneEvent,
    dispatch,
  } = props

  return (
    <EventCard
      event={ev}
      board={eventBoard}
      showAppliesTo={showAppliesTo}
      editing={editingId === ev.id}
      selected={focusedEventId === ev.id}
      onSelect={() => setFocusedEventId(ev.id)}
      onToggleEnabled={() =>
        dispatch({
          type: 'LOGIC_UPDATE_EVENT',
          boardId: eventBoard.boardId,
          event: { ...ev, enabled: !ev.enabled },
        })
      }
      onEdit={() => {
        setFocusedEventId(ev.id)
        setEditingId(editingId === ev.id ? null : ev.id)
      }}
      onClone={() => onCloneEvent(ev, eventBoard)}
      onDelete={() => {
        dispatch({
          type: 'LOGIC_DELETE_EVENT',
          boardId: eventBoard.boardId,
          eventId: ev.id,
        })
        if (editingId === ev.id) setEditingId(null)
        if (focusedEventId === ev.id) setFocusedEventId(null)
      }}
      onChange={(next) =>
        dispatch({
          type: 'LOGIC_UPDATE_EVENT',
          boardId: eventBoard.boardId,
          event: next,
        })
      }
      onDoneEditing={() => setEditingId(null)}
    />
  )
}

export function LogicBoardEventsList(listProps: LogicBoardEventsListProps) {
  const {
    project,
    board,
    sceneId,
    clipboardHint,
    setEditingId,
    setFocusedEventId,
    newTrigger,
    setNewTrigger,
    dispatch,
  } = listProps
  const sceneBoards = logicBoardsForScene(project, sceneId)
  const groupedView = sceneBoards.length > 1
  const totalRules = sceneBoards.reduce((n, b) => n + b.events.length, 0)

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      {!board && sceneBoards.length === 0 ? (
        <div className="text-[var(--muted)] text-sm mt-8 text-center max-w-md mx-auto leading-relaxed">
          Select an entity in the Scenes panel, then create a rulesheet with{' '}
          <span className="text-[var(--text)]">New rulesheet for selection</span>.
        </div>
      ) : (
        <>
          <div className="text-xs text-[var(--muted)] mb-3 flex items-center gap-2 flex-wrap">
            {groupedView ? (
              <span>
                Rules in scene:{' '}
                <span className="text-[var(--text)] font-medium">
                  {sceneBoards.length} sheets, {totalRules} rules
                </span>
              </span>
            ) : (
              board && (
                <span>
                  Rules for{' '}
                  <span className="text-[var(--text)] font-medium">
                    {rulesheetAppliesToLabel(project, board)}
                  </span>{' '}
                  ({board.events.length})
                </span>
              )
            )}
            {clipboardHint && (
              <span className="text-[10px] text-[var(--accent)]">{clipboardHint}</span>
            )}
            <span className="text-[10px] text-[var(--muted-2)]">
              Ctrl+C copy · Ctrl+V paste · Ctrl+D duplicate
            </span>
          </div>

          {groupedView
            ? sceneBoards.map((eventBoard) => (
                <section key={eventBoard.boardId} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-center gap-2 border-b border-[var(--border)] pb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Applies to
                    </span>
                    <span
                      className="text-xs font-medium text-[var(--accent)]"
                      title={logicBoardLabel(project, eventBoard)}
                    >
                      {rulesheetAppliesToLabel(project, eventBoard)}
                    </span>
                    <span className="text-[10px] text-[var(--muted-2)]">
                      ({eventBoard.events.length})
                    </span>
                  </div>
                  {eventBoard.events.length === 0 ? (
                    <p className="text-[11px] italic text-[var(--muted-2)] mb-2">
                      No rules on this sheet yet.
                    </p>
                  ) : (
                    eventBoard.events.map((ev) => (
                      <div key={`${eventBoard.boardId}:${ev.id}`}>
                        {renderEventCard(ev, eventBoard, listProps, false)}
                      </div>
                    ))
                  )}
                </section>
              ))
            : board?.events.map((ev) => (
                <div key={`${board.boardId}:${ev.id}`}>
                  {renderEventCard(ev, board, listProps, true)}
                </div>
              ))}

          {board && (
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
                Add rule to {rulesheetAppliesToLabel(project, board)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
