import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import ResizeHandle from '../../components/ResizeHandle'
import { usePersistedWidth } from '../../hooks/usePersistedWidth'
import { RulesheetControls } from './RulesheetControls'
import { LogicEventsSidebar } from './LogicEventsSidebar'
import EventEditor from './EventEditor'
import { LogicInspectorPanel } from './LogicInspectorPanel'
import { logicBoardLabel, logicBoardsForScene } from '../../utils/project'
import type { NewTriggerPick } from './picker-constants'
import { useLogicBlockSelection } from './useLogicBlockSelection'

export type LogicBoardVisualLayoutProps = Readonly<{
  project: ProjectDoc
  sceneId: string
  board: LogicBoard | null
  focusedEvent: LogicEvent | null
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  setSelectedBoardId: (id: string) => void
  newTrigger: NewTriggerPick
  setNewTrigger: (t: NewTriggerPick) => void
  sceneEntities: ReturnType<typeof import('../../utils/project').getEntitiesInScene>
  selectedEntityId: number | null
  boardForSelection: LogicBoard | undefined
  canCreateForSelection: boolean
  advancedOpen: boolean
  setAdvancedOpen: (v: boolean) => void
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

export function LogicBoardVisualLayout(props: LogicBoardVisualLayoutProps) {
  const {
    project,
    sceneId,
    board,
    focusedEvent,
    focusedEventId,
    setFocusedEventId,
    setSelectedBoardId,
    newTrigger,
    setNewTrigger,
    sceneEntities,
    selectedEntityId,
    boardForSelection,
    canCreateForSelection,
    advancedOpen,
    setAdvancedOpen,
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

  const [leftW, setLeftW] = usePersistedWidth('artcade.logic-left-w-v3', 280)
  const [rightW, setRightW] = usePersistedWidth('artcade.logic-right-w-v3', 320)
  const blockSelection = useLogicBlockSelection(focusedEventId)
  const sceneBoards = logicBoardsForScene(project, sceneId)

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside
        style={{ width: leftW }}
        className="shrink-0 border-r border-[var(--outline)] flex flex-col min-h-0 overflow-hidden"
      >
        <RulesheetControls
          project={project}
          board={board}
          sceneEntities={sceneEntities}
          selectedEntityId={selectedEntityId}
          boardForSelection={boardForSelection}
          canCreateForSelection={canCreateForSelection}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          classes={classes}
          newClass={newClass}
          setNewClass={setNewClass}
          onSelectEntity={onSelectEntity}
          onCreateForEntity={onCreateForEntity}
          onCreateClassRulesheet={onCreateClassRulesheet}
          onDeleteBoard={onDeleteBoard}
        />
        <LogicEventsSidebar
          project={project}
          board={board}
          sceneBoards={sceneBoards}
          focusedEventId={focusedEventId}
          setFocusedEventId={setFocusedEventId}
          setSelectedBoardId={setSelectedBoardId}
          newTrigger={newTrigger}
          setNewTrigger={setNewTrigger}
          dispatch={dispatch}
          onCloneEvent={onCloneEvent}
          onDeleteEvent={onDeleteEvent}
          onMoveEvent={onMoveEvent}
        />
      </aside>

      <ResizeHandle side="left" onResize={(d) => setLeftW((w) => w + d)} />

      <section className="flex-1 min-w-0 flex flex-col bg-[var(--logic-bg)] overflow-hidden">
        <header className="shrink-0 px-4 py-2 border-b border-[var(--outline)] bg-[var(--surface)]">
          <p className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Single Event Editor</p>
          <p className="text-sm font-semibold text-[var(--primary)]">
            {board ? logicBoardLabel(project, board) : 'Select a rulesheet'}
          </p>
        </header>
        <div className="flex-1 min-h-0 overflow-auto panel-scroll p-4">
          {focusedEvent && board ? (
            <EventEditor
              event={focusedEvent}
              board={board}
              project={project}
              onChange={onPatchEvent}
              inspectorMode
              onBlockSelect={blockSelection.setSelection}
              isBlockSelected={blockSelection.isSelected}
            />
          ) : (
            <p className="text-sm text-[var(--muted)] mt-8 text-center max-w-md mx-auto">
              Select an event from the list to edit trigger, conditions, and actions.
            </p>
          )}
        </div>
      </section>

      <ResizeHandle side="right" onResize={(d) => setRightW((w) => w - d)} />

      <aside
        style={{ width: rightW }}
        className="shrink-0 border-l border-[var(--outline)] min-h-0 overflow-hidden"
      >
        <LogicInspectorPanel
          project={project}
          board={board}
          event={focusedEvent}
          selection={blockSelection.selection}
          onPatchEvent={onPatchEvent}
        />
      </aside>
    </div>
  )
}
