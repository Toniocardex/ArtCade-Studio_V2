// ---------------------------------------------------------------------------
// LogicBoardLuaMode — read-only Lua preview for the active rulesheet.
// ---------------------------------------------------------------------------

import type { Dispatch } from 'react'
import { useEditorStore } from '../../store/editor-store'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import type { LogicSyncStatus } from '../../utils/logic-board/auto-apply-status'
import type { compileProjectLogic } from '../../utils/logic-board/logic-compile-service'
import { LogicBoardCompileErrorBanner } from '../../components/LogicBoardCompileErrorBanner'
import { openCombinedMainScript } from '../../utils/logic-board-project-flow'
import { extractBoardLuaSlice } from '../../utils/logic-board/extract-board-lua-slice'
import {
  logicBoardCompilerLabel,
  logicBoardLuaCommentLabel,
} from '../../utils/logic-board/labels'
import { LogicBoardHeader } from './LogicBoardHeader'
import { LogicBoardLuaPreview } from './LogicBoardLuaPreview'

type EditorDispatch = Dispatch<Action>

export type LogicBoardLuaModeProps = Readonly<{
  project: ProjectDoc
  boards: LogicBoard[]
  board: LogicBoard | null
  lua: string
  compileError: string | null
  boardConfigWarning: string | null
  compileResult: ReturnType<typeof compileProjectLogic>
  showFullMain: boolean
  setShowFullMain: (v: boolean | ((prev: boolean) => boolean)) => void
  applyMsg: string | null
  syncStatus: LogicSyncStatus
  setPanelMode: (mode: 'visual' | 'lua') => void
  setSelectedBoardId: (id: string | null) => void
  dispatch: EditorDispatch
  onApply: () => void
  onRetrySync: () => void
  sceneHasObjects: boolean
}>

export function LogicBoardLuaMode({
  project,
  boards,
  board,
  lua,
  compileError,
  boardConfigWarning,
  compileResult,
  showFullMain,
  setShowFullMain,
  applyMsg,
  syncStatus,
  setPanelMode,
  setSelectedBoardId,
  dispatch,
  onApply,
  onRetrySync,
  sceneHasObjects,
}: LogicBoardLuaModeProps) {
  const store = useEditorStore()
  const mainPath = project.mainScriptPath
  const boardLabel = board ? logicBoardLuaCommentLabel(board) : ''
  const slice = extractBoardLuaSlice(lua, boardLabel)
  const displayLua = showFullMain ? lua : slice.text
  const previewTitle = board
    ? `Generated · ${logicBoardCompilerLabel(board)}`
    : 'Generated script'
  const previewSubtitle = showFullMain
    ? `Full ${mainPath}`
    : `Section of ${mainPath}`
  const openMainTooltip =
    `Opens the read-only Combined Preview for ${mainPath}. ` +
    'My Script remains editable and is never regenerated.'

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--bg)]">
      <LogicBoardHeader
        mode="lua"
        setMode={setPanelMode}
        boards={boards}
        board={board}
        onSelectBoard={setSelectedBoardId}
        onRenameBoard={(boardId, name) =>
          dispatch({ type: 'LOGIC_RENAME_BOARD', boardId, name })
        }
        onApply={onApply}
        onRetrySync={onRetrySync}
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
      <LogicBoardLuaPreview
        lua={displayLua}
        title={previewTitle}
        subtitle={previewSubtitle}
        emptyMessage={
          !showFullMain && slice.sectionCount === 0
            ? 'No Lua for this board yet. Add or enable events in Rules.'
            : undefined
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => setShowFullMain((v) => !v)}
            className="px-3 py-2 rounded text-xs text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border-2)] hover:bg-[var(--panel-3)]"
          >
            {showFullMain ? 'Show this board only' : 'Show full main'}
          </button>
        }
        action={
          <button
            type="button"
            title={openMainTooltip}
            disabled={!!compileError}
            onClick={() => {
              if (compileResult.ok) {
                void openCombinedMainScript(dispatch, store.getState)
              }
            }}
            className="px-4 py-2 rounded text-xs font-semibold border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open Combined Preview →
          </button>
        }
      />
    </div>
  )
}
