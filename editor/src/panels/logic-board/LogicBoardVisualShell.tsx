// ---------------------------------------------------------------------------
// LogicBoardVisualShell — visual mode chrome: header, banners, rules layout.
// ---------------------------------------------------------------------------

import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { EntityDef } from '../../types'
import type { LogicSyncStatus } from '../../utils/logic-board/auto-apply-status'
import type { AuthoringMode } from '../../types/authoring-mode'
import { LogicBoardCompileErrorBanner } from '../../components/LogicBoardCompileErrorBanner'
import { LogicBoardHeader } from './LogicBoardHeader'
import { LogicBoardVisualLayout } from './LogicBoardVisualLayout'

type EditorDispatch = Dispatch<Action>

export type LogicBoardVisualShellProps = Readonly<{
  project: ProjectDoc
  authoringMode: AuthoringMode
  panelMode: 'visual' | 'lua'
  setPanelMode: (mode: 'visual' | 'lua') => void
  boards: LogicBoard[]
  board: LogicBoard | null
  setSelectedBoardId: (id: string | null) => void
  dispatch: EditorDispatch
  compileError: string | null
  boardConfigWarning: string | null
  syncStatus: LogicSyncStatus
  retrySync: () => void
  handleApply: () => void
  applyMsg: string | null
  sceneHasObjects: boolean
  clipboardHint: string | null
  sceneId: string
  focusedEventId: string | null
  focusEventForLayout: (id: string | null) => void
  sceneEntities: EntityDef[]
  effectiveSelectedEntityId: number | null
  boardForSelection: LogicBoard | undefined
  canCreateForSelection: boolean
  classes: string[]
  newClass: string
  setNewClass: (className: string) => void
  selectEntityForRules: (entityId: number) => void
  onCreateRulesheet: (entityId: number) => void
  onOpenRulesheet: (boardId: string) => void
  onGoToCanvas: () => void
  onCreateClassRulesheet: () => void
  onDeleteBoard: () => void
  patchFocusedEvent: (event: LogicEvent) => void
  cloneEvent: (ev: LogicEvent, eventBoard?: LogicBoard) => void
  deleteEvent: (ev: LogicEvent, eventBoard: LogicBoard) => void
  moveEvent: (eventBoard: LogicBoard, eventId: string, toIndex: number) => void
}>

export function LogicBoardVisualShell({
  project,
  authoringMode,
  panelMode,
  setPanelMode,
  boards,
  board,
  setSelectedBoardId,
  dispatch,
  compileError,
  boardConfigWarning,
  syncStatus,
  retrySync,
  handleApply,
  applyMsg,
  sceneHasObjects,
  clipboardHint,
  sceneId,
  focusedEventId,
  focusEventForLayout,
  sceneEntities,
  effectiveSelectedEntityId,
  boardForSelection,
  canCreateForSelection,
  classes,
  newClass,
  setNewClass,
  selectEntityForRules,
  onCreateRulesheet,
  onOpenRulesheet,
  onGoToCanvas,
  onCreateClassRulesheet,
  onDeleteBoard,
  patchFocusedEvent,
  cloneEvent,
  deleteEvent,
  moveEvent,
}: LogicBoardVisualShellProps) {
  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--bg)]"
      data-panel="logic-board"
    >
      <LogicBoardHeader
        mode={panelMode}
        setMode={setPanelMode}
        boards={boards}
        board={board}
        onSelectBoard={setSelectedBoardId}
        onRenameBoard={(boardId, name) =>
          dispatch({ type: 'LOGIC_RENAME_BOARD', boardId, name })
        }
        onApply={handleApply}
        onRetrySync={retrySync}
        applyMsg={applyMsg}
        syncStatus={syncStatus}
        project={project}
        sceneHasObjects={sceneHasObjects}
      />

      {compileError && <LogicBoardCompileErrorBanner error={compileError} />}
      {!compileError && boardConfigWarning && (
        <LogicBoardCompileErrorBanner
          title="Rulesheet configuration issue"
          error={boardConfigWarning}
          hint="Fix these rules before Apply or Play will use stale or blank logic."
        />
      )}

      {authoringMode === 'base' && (
        <p className="flex-shrink-0 px-4 py-1.5 text-[10px] leading-snug text-[var(--muted)] border-b border-[var(--border)] bg-[var(--panel-2)]">
          <strong className="text-[var(--text)] font-medium">Base view</strong> — guided
          rules with the full toolset (Canvas, Logic, Script). Use{' '}
          <strong>When</strong> for keys (including OR). Turn on{' '}
          <strong>If</strong> only for extra filters. Switch to{' '}
          <strong>Advanced</strong> in the View menu for a denser layout.
        </p>
      )}

      {clipboardHint ? (
        <p className="shrink-0 px-3 py-1 text-[10px] text-[var(--muted)] border-b border-[var(--outline)]">
          {clipboardHint}
        </p>
      ) : null}

      <LogicBoardVisualLayout
        project={project}
        sceneId={sceneId}
        board={board}
        focusedEventId={focusedEventId}
        setFocusedEventId={focusEventForLayout}
        sceneEntities={sceneEntities}
        selectedEntityId={effectiveSelectedEntityId}
        boardForSelection={boardForSelection}
        canCreateForSelection={canCreateForSelection}
        classes={classes}
        newClass={newClass}
        setNewClass={setNewClass}
        onSelectEntity={selectEntityForRules}
        onCreateRulesheet={onCreateRulesheet}
        onOpenRulesheet={onOpenRulesheet}
        onGoToCanvas={onGoToCanvas}
        onCreateClassRulesheet={onCreateClassRulesheet}
        onDeleteBoard={onDeleteBoard}
        dispatch={dispatch}
        onPatchEvent={patchFocusedEvent}
        onCloneEvent={cloneEvent}
        onDeleteEvent={deleteEvent}
        onMoveEvent={moveEvent}
      />
    </div>
  )
}
