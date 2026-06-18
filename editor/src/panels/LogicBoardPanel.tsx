// ---------------------------------------------------------------------------
// Logic Board panel — entry point; orchestration lives in useLogicBoardPanelState.
// ---------------------------------------------------------------------------

import { LogicBoardLuaMode } from './logic-board/LogicBoardLuaMode'
import { LogicBoardVisualShell } from './logic-board/LogicBoardVisualShell'
import { useLogicBoardPanelState } from './logic-board/useLogicBoardPanelState'

function LogicBoardEmptyProject() {
  return (
    <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
      Open a project to edit Logic Boards.
    </div>
  )
}

export default function LogicBoardPanel() {
  const state = useLogicBoardPanelState()
  const { project, panelMode, selection, compile, events, rulesheet, boards, dispatch } =
    state

  if (!project) {
    return <LogicBoardEmptyProject />
  }

  if (panelMode === 'lua') {
    return (
      <LogicBoardLuaMode
        project={project}
        boards={boards}
        board={selection.board}
        lua={compile.lua}
        compileError={compile.compileError}
        boardConfigWarning={compile.boardConfigWarning}
        compileResult={compile.compileResult}
        showFullMain={compile.showFullMain}
        setShowFullMain={compile.setShowFullMain}
        applyMsg={compile.applyMsg}
        syncStatus={compile.syncStatus}
        setPanelMode={state.setPanelMode}
        setSelectedBoardId={selection.setSelectedBoardId}
        dispatch={dispatch}
        onApply={compile.handleApply}
        onRetrySync={compile.retrySync}
        sceneHasObjects={selection.sceneHasObjects}
      />
    )
  }

  return (
    <LogicBoardVisualShell
      project={project}
      authoringMode={state.authoringMode}
      panelMode={panelMode}
      setPanelMode={state.setPanelMode}
      boards={boards}
      board={selection.board}
      setSelectedBoardId={selection.setSelectedBoardId}
      dispatch={dispatch}
      compileError={compile.compileError}
      boardConfigWarning={compile.boardConfigWarning}
      syncStatus={compile.syncStatus}
      retrySync={compile.retrySync}
      handleApply={compile.handleApply}
      applyMsg={compile.applyMsg}
      sceneHasObjects={selection.sceneHasObjects}
      clipboardHint={events.clipboardHint}
      sceneId={selection.sceneId}
      focusedEventId={events.focusedEventId}
      focusEventForLayout={events.focusEventForLayout}
      sceneEntities={selection.sceneEntities}
      effectiveSelectedEntityId={selection.effectiveSelectedEntityId}
      boardForSelection={selection.boardForSelection}
      canCreateForSelection={selection.canCreateForSelection}
      classes={rulesheet.classes}
      newClass={rulesheet.newClass}
      setNewClass={rulesheet.setNewClass}
      selectEntityForRules={selection.selectEntityForRules}
      onCreateRulesheet={rulesheet.onCreateRulesheet}
      onOpenRulesheet={rulesheet.onOpenRulesheet}
      onGoToCanvas={rulesheet.onGoToCanvas}
      onCreateClassRulesheet={rulesheet.onCreateClassRulesheet}
      onDeleteBoard={rulesheet.onDeleteBoard}
      patchFocusedEvent={events.patchFocusedEvent}
      cloneEvent={events.cloneEvent}
      deleteEvent={events.deleteEvent}
      moveEvent={events.moveEvent}
    />
  )
}
