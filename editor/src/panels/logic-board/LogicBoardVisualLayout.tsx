// ---------------------------------------------------------------------------
// LogicBoardVisualLayout — single-surface rules editor.
//
// One centered column: rulesheet toolbar → rules list (accordion cards that
// expand into the full When/If/Then editor in place) → variables. New rules
// come from a categorized trigger modal; rulesheet creation lives in the
// empty state and in the "New rulesheet" modal.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, type Dispatch } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent, LogicTriggerType } from '../../types/logic-board'
import { logicBoardLabel, logicBoardsForScene } from '../../utils/project'
import { allowedTriggersForTarget } from '../../utils/logic-board/trigger-compatibility'
import { createLogicEvent } from '../../utils/logic-board/factory'
import { defaultTrigger } from './options'
import { scrollLogicEventRowIntoViewSoon } from '../../utils/logic-board/logic-event-list-ui'
import { AddRuleModal } from './AddRuleModal'
import { RulesheetCreateForm, type RulesheetCreateFormProps } from './RulesheetCreateForm'
import { LogicRulesList } from './LogicRulesList'
import { LogicVariablesPanel } from './LogicVariablesPanel'

export type LogicBoardVisualLayoutProps = Readonly<{
  project: ProjectDoc
  sceneId: string
  board: LogicBoard | null
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  sceneEntities: ReturnType<typeof import('../../utils/project').getEntitiesInScene>
  selectedEntityId: number | null
  boardForSelection: LogicBoard | undefined
  canCreateForSelection: boolean
  classes: string[]
  newClass: string
  setNewClass: (v: string) => void
  onSelectEntity: (entityId: number) => void
  onCreateForEntity: (entityId: number) => void
  onCreateClassRulesheet: () => void
  onDeleteBoard: () => void
  dispatch: Dispatch<Action>
  onPatchEvent: (event: LogicEvent) => void
  onCloneEvent: (event: LogicEvent, board: LogicBoard) => void
  onDeleteEvent: (event: LogicEvent, board: LogicBoard) => void
  onMoveEvent: (board: LogicBoard, eventId: string, toIndex: number) => void
}>

function NewRulesheetModal({
  onClose,
  ...form
}: Readonly<RulesheetCreateFormProps & { onClose: () => void }>) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
  }, [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="new-rulesheet-title"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[210] m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-0 bg-transparent p-6 backdrop:bg-black/60"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-3">
          <h2 id="new-rulesheet-title" className="text-sm font-semibold">
            New rulesheet
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </header>
        <div className="px-4 py-4">
          <RulesheetCreateForm {...form} />
        </div>
      </div>
    </dialog>
  )
}

export function LogicBoardVisualLayout(props: LogicBoardVisualLayoutProps) {
  const {
    project,
    sceneId,
    board,
    focusedEventId,
    setFocusedEventId,
    sceneEntities,
    selectedEntityId,
    boardForSelection,
    canCreateForSelection,
    classes,
    newClass,
    setNewClass,
    onSelectEntity,
    onCreateForEntity,
    onCreateClassRulesheet,
    onDeleteBoard,
    dispatch,
    onPatchEvent,
    onCloneEvent,
    onDeleteEvent,
    onMoveEvent,
  } = props

  const [addRuleOpen, setAddRuleOpen] = useState(false)
  const [newRulesheetOpen, setNewRulesheetOpen] = useState(false)
  const sceneBoardCount = logicBoardsForScene(project, sceneId).length

  const createFormProps: RulesheetCreateFormProps = {
    project,
    sceneEntities,
    selectedEntityId,
    boardForSelection,
    canCreateForSelection,
    classes,
    newClass,
    setNewClass,
    onSelectEntity,
    onCreateForEntity: (entityId) => {
      onCreateForEntity(entityId)
      setNewRulesheetOpen(false)
    },
    onCreateClassRulesheet: () => {
      onCreateClassRulesheet()
      setNewRulesheetOpen(false)
    },
  }

  const addRule = (type: LogicTriggerType) => {
    if (!board) return
    const ev = createLogicEvent(defaultTrigger(type))
    dispatch({ type: 'LOGIC_ADD_EVENT', boardId: board.boardId, event: ev })
    setFocusedEventId(ev.id)
    setAddRuleOpen(false)
    scrollLogicEventRowIntoViewSoon(ev.id)
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[var(--logic-bg)]">
      <div className="flex-1 min-h-0 overflow-auto panel-scroll">
        <div className="mx-auto w-full max-w-[900px] px-4 py-4">
          {!board ? (
            <div
              className="mx-auto mt-8 max-w-xl rounded-[var(--radius-md)] border border-[var(--outline)] bg-[var(--surface)] p-6 shadow-sm"
              data-testid="logic-board-empty-state"
            >
              <p className="text-sm font-semibold text-[var(--primary)]">No rulesheet yet</p>
              <p className="mb-4 mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                A rulesheet holds the rules for one object type. Pick an object and create its
                rulesheet to start adding logic.
              </p>
              <RulesheetCreateForm {...createFormProps} />
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--primary)]">
                    {logicBoardLabel(project, board)}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {board.events.length === 1
                      ? '1 rule'
                      : `${board.events.length} rules`}
                    {' · run top to bottom'}
                    {sceneBoardCount > 1
                      ? ` · ${sceneBoardCount} rulesheets in scene (switch in the header)`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewRulesheetOpen(true)}
                  className="rounded border border-[var(--outline)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)]"
                >
                  New rulesheet…
                </button>
                <button
                  type="button"
                  onClick={onDeleteBoard}
                  title="Delete this rulesheet and all its rules"
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--outline)] px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setAddRuleOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]"
                >
                  <Plus size={13} />
                  Add rule
                </button>
              </div>

              {board.events.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--outline)] p-8 text-center">
                  <p className="text-sm font-semibold text-[var(--primary)]">No rules yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-[var(--muted)]">
                    A rule is <strong>When</strong> (trigger) + optional checks +{' '}
                    <strong>Then</strong> (actions).
                  </p>
                  <button
                    type="button"
                    onClick={() => setAddRuleOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]"
                  >
                    <Plus size={13} />
                    Add your first rule
                  </button>
                </div>
              ) : (
                <LogicRulesList
                  project={project}
                  board={board}
                  focusedEventId={focusedEventId}
                  setFocusedEventId={setFocusedEventId}
                  dispatch={dispatch}
                  onPatchEvent={onPatchEvent}
                  onCloneEvent={onCloneEvent}
                  onDeleteEvent={onDeleteEvent}
                  onMoveEvent={onMoveEvent}
                />
              )}

              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--outline)] bg-[var(--surface)]">
                <LogicVariablesPanel board={board} />
              </div>
            </>
          )}
        </div>
      </div>

      {addRuleOpen && board && (
        <AddRuleModal
          triggerTypes={allowedTriggersForTarget(board.target.type)}
          onPick={addRule}
          onClose={() => setAddRuleOpen(false)}
        />
      )}

      {newRulesheetOpen && (
        <NewRulesheetModal {...createFormProps} onClose={() => setNewRulesheetOpen(false)} />
      )}
    </div>
  )
}
