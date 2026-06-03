import { useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import { ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent, LogicTriggerType } from '../../types/logic-board'
import { TypePicker } from '../../components/logic-board/TypePicker'
import { HierarchicalBlockPicker } from '../../components/logic-board/HierarchicalBlockPicker'
import { createLogicEvent } from '../../utils/logic-board/factory'
import { logicBoardLabel, rulesheetAppliesToLabel } from '../../utils/project'
import { defaultTrigger } from './options'
import { allowedTriggersForTarget } from '../../utils/logic-board/trigger-compatibility'
import { LogicEventRow } from './LogicEventRow'
import { LogicVariablesPanel } from './LogicVariablesPanel'
import { NEW_TRIGGER_NONE, type NewTriggerPick } from './picker-constants'
import LogicIconButton from '../../components/logic-board/LogicIconButton'
import { scrollLogicEventRowIntoViewSoon } from '../../utils/logic-board/logic-event-list-ui'
import {
  groupEventsByVisualCategory,
  orderedVisualGroups,
} from '../../utils/logic-board/event-visual-group'

export type LogicEventsSidebarProps = Readonly<{
  project: ProjectDoc
  board: LogicBoard | null
  sceneBoards: readonly LogicBoard[]
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  setSelectedBoardId: (boardId: string) => void
  newTrigger: NewTriggerPick
  setNewTrigger: (t: NewTriggerPick) => void
  dispatch: Dispatch<Action>
  onCloneEvent: (event: LogicEvent, board: LogicBoard) => void
  onDeleteEvent: (event: LogicEvent, board: LogicBoard) => void
  onMoveEvent: (board: LogicBoard, eventId: string, toIndex: number) => void
}>

function EventListForBoard({
  project,
  eventBoard,
  focusedEventId,
  setFocusedEventId,
  onCloneEvent,
  onDeleteEvent,
  onMoveEvent,
  dispatch,
}: Readonly<{
  project: ProjectDoc
  eventBoard: LogicBoard
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  onCloneEvent: (event: LogicEvent, board: LogicBoard) => void
  onDeleteEvent: (event: LogicEvent, board: LogicBoard) => void
  onMoveEvent: (board: LogicBoard, eventId: string, toIndex: number) => void
  dispatch: Dispatch<Action>
}>) {
  const focusedIndex = eventBoard.events.findIndex((e) => e.id === focusedEventId)
  const focused = focusedIndex >= 0 ? eventBoard.events[focusedIndex] : null

  const visualGroups = useMemo(
    () => orderedVisualGroups(groupEventsByVisualCategory(eventBoard.events)),
    [eventBoard.events],
  )

  return (
    <>
      {visualGroups.map(({ group, events }) => (
        <div key={group}>
          <div className="px-2 py-1 text-[8px] font-semibold uppercase tracking-widest text-[var(--muted)] border-b border-[var(--outline-faint)]">
            {group}
          </div>
          {events.map((ev) => {
            const i = eventBoard.events.findIndex((e) => e.id === ev.id)
            return (
              <div key={ev.id} className="group relative">
                <LogicEventRow
                  event={ev}
                  index={i}
                  board={eventBoard}
                  project={project}
                  selected={focusedEventId === ev.id}
                  onSelect={() => {
                    setFocusedEventId(ev.id)
                    scrollLogicEventRowIntoViewSoon(ev.id)
                  }}
                />
              </div>
            )
          })}
        </div>
      ))}
      {focused && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--outline-subtle)]">
          <button
            type="button"
            className={`relative h-[16px] w-8 shrink-0 rounded transition-colors ${
              focused.enabled ? 'bg-[var(--outline-focus)]' : 'bg-[var(--outline)]'
            }`}
            title={focused.enabled ? 'Disable rule' : 'Enable rule'}
            onClick={() =>
              dispatch({
                type: 'LOGIC_UPDATE_EVENT',
                boardId: eventBoard.boardId,
                event: { ...focused, enabled: !focused.enabled },
              })
            }
          />
          <LogicIconButton title="Clone rule" ariaLabel="Clone rule" onClick={() => onCloneEvent(focused, eventBoard)}>
            <Copy size={12} />
          </LogicIconButton>
          <LogicIconButton
            title="Delete rule"
            ariaLabel="Delete rule"
            danger
            onClick={() => onDeleteEvent(focused, eventBoard)}
          >
            <Trash2 size={12} />
          </LogicIconButton>
          <LogicIconButton
            title="Move rule up"
            ariaLabel="Move rule up"
            disabled={focusedIndex <= 0}
            onClick={() => onMoveEvent(eventBoard, focused.id, focusedIndex - 1)}
          >
            <ChevronUp size={12} />
          </LogicIconButton>
          <LogicIconButton
            title="Move rule down"
            ariaLabel="Move rule down"
            disabled={focusedIndex < 0 || focusedIndex >= eventBoard.events.length - 1}
            onClick={() => onMoveEvent(eventBoard, focused.id, focusedIndex + 1)}
          >
            <ChevronDown size={12} />
          </LogicIconButton>
        </div>
      )}
    </>
  )
}

export function LogicEventsSidebar({
  project,
  board,
  sceneBoards,
  focusedEventId,
  setFocusedEventId,
  setSelectedBoardId,
  newTrigger,
  setNewTrigger,
  dispatch,
  onCloneEvent,
  onDeleteEvent,
  onMoveEvent,
}: LogicEventsSidebarProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const groupedView = sceneBoards.length > 1
  const addBoard = board

  return (
    <div className="h-full flex flex-col min-h-0 bg-[var(--surface)]" data-panel="logic-events-sidebar">
      <header className="shrink-0 px-3 py-2 border-b border-[var(--outline)]">
        <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Rulesheet Events</p>
        {board && !groupedView ? (
          <p
            className="text-[11px] font-semibold text-[var(--primary)] truncate mt-0.5"
            title={logicBoardLabel(project, board)}
          >
            {rulesheetAppliesToLabel(project, board)}
          </p>
        ) : (
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            {groupedView ? `${sceneBoards.length} rulesheets in scene` : 'No rulesheet selected'}
          </p>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-auto panel-scroll">
        {groupedView ? (
          sceneBoards.map((eventBoard) => (
            <section key={eventBoard.boardId} className="border-b border-[var(--outline-subtle)]">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-[10px] font-semibold text-[var(--primary-soft)] hover:bg-[var(--outline-faint)]"
                onClick={() => setSelectedBoardId(eventBoard.boardId)}
              >
                {rulesheetAppliesToLabel(project, eventBoard)} ({eventBoard.events.length})
              </button>
              {eventBoard.boardId === board?.boardId ? (
                <EventListForBoard
                  project={project}
                  eventBoard={eventBoard}
                  focusedEventId={focusedEventId}
                  setFocusedEventId={setFocusedEventId}
                  onCloneEvent={onCloneEvent}
                  onDeleteEvent={onDeleteEvent}
                  onMoveEvent={onMoveEvent}
                  dispatch={dispatch}
                />
              ) : (
                eventBoard.events.map((ev, i) => (
                  <LogicEventRow
                    key={ev.id}
                    event={ev}
                    index={i}
                    board={eventBoard}
                    project={project}
                    selected={false}
                    onSelect={() => {
                      setSelectedBoardId(eventBoard.boardId)
                      setFocusedEventId(ev.id)
                    }}
                  />
                ))
              )}
            </section>
          ))
        ) : !board || board.events.length === 0 ? (
          <p className="p-3 text-[10px] text-[var(--muted)] leading-relaxed">
            Add a rule with the controls below.
          </p>
        ) : (
          <EventListForBoard
            project={project}
            eventBoard={board}
            focusedEventId={focusedEventId}
            setFocusedEventId={setFocusedEventId}
            onCloneEvent={onCloneEvent}
            onDeleteEvent={onDeleteEvent}
            onMoveEvent={onMoveEvent}
            dispatch={dispatch}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--outline)] px-2 py-2 space-y-2">
        {addBoard && (
          <>
            <button
              type="button"
              className="w-full text-[10px] px-2 py-1 rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--surface-2)] hover:bg-[var(--outline-faint)]"
              onClick={() => setPickerOpen(true)}
            >
              Browse triggers...
            </button>
            {pickerOpen && (
              <div
                className="fixed inset-0 z-[70] flex justify-end bg-black/40"
                role="presentation"
                onClick={() => setPickerOpen(false)}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <HierarchicalBlockPicker
                    kind="trigger"
                    types={allowedTriggersForTarget(addBoard.target.type)}
                    title="Add trigger"
                    onClose={() => setPickerOpen(false)}
                    onPick={(type) => {
                      const ev = createLogicEvent(defaultTrigger(type as LogicTriggerType))
                      dispatch({ type: 'LOGIC_ADD_EVENT', boardId: addBoard.boardId, event: ev })
                      setFocusedEventId(ev.id)
                      setPickerOpen(false)
                    }}
                  />
                </div>
              </div>
            )}
            <TypePicker
              kind="trigger"
              types={allowedTriggersForTarget(addBoard.target.type)}
              value={newTrigger}
              onChange={(t) => setNewTrigger(t as NewTriggerPick)}
              className="w-full max-w-none"
              placeholder="Quick add trigger…"
              placeholderValue={NEW_TRIGGER_NONE}
            />
            <button
              type="button"
              disabled={!newTrigger}
              className="w-full text-[10px] py-1.5 rounded-[var(--radius)] border border-dashed border-[var(--outline)] disabled:opacity-50 hover:border-[var(--accent)]"
              onClick={() => {
                if (!newTrigger) return
                const ev = createLogicEvent(defaultTrigger(newTrigger))
                dispatch({ type: 'LOGIC_ADD_EVENT', boardId: addBoard.boardId, event: ev })
                setFocusedEventId(ev.id)
                setNewTrigger(NEW_TRIGGER_NONE)
              }}
            >
              Add rule
            </button>
          </>
        )}
      </div>

      <LogicVariablesPanel board={board} />
    </div>
  )
}
