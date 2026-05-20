import { useEffect, useMemo, useState } from 'react'
import { useEditor } from '../store/editor-store'
import { EngineScriptEditor } from '../components/EngineScriptEditor'
import { LogicBoardScriptConflictBanner } from '../components/LogicBoardScriptConflictBanner'
import { compileLogicBoard } from '../utils/logic-board/compiler'
import { logicBoardScriptOutOfSync } from '../utils/logic-board-script-conflict'
import { syncLogicBoardToScript } from '../utils/sync-logic-board-script'

/** Tracks the <html data-theme> attribute so the editor follows the app theme. */
function useThemeMode(): 'dark' | 'light' {
  const read = () =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

function ScriptTabBar({ paths, activePath, dirtyPaths, onSelect }: {
  paths:      string[]
  activePath: string | null
  dirtyPaths: Set<string>
  onSelect:   (path: string) => void
}) {
  return (
    <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--panel)] flex-shrink-0">
      {paths.map(p => {
        const label = p.split('/').pop() ?? p
        const active = p === activePath
        return (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] whitespace-nowrap
                        border-r border-[var(--border)] transition-colors ${
                          active
                            ? 'bg-[var(--bg)] text-[var(--accent)] border-t-2 border-t-[var(--accent)]'
                            : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)]'
                        }`}
          >
            {label}
            {dirtyPaths.has(p) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-2)] flex-shrink-0" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function ScriptEditorPanel() {
  const { state, dispatch } = useEditor()
  const { openScripts, activeScriptPath, project } = state
  const themeMode = useThemeMode()
  const [dismissedConflict, setDismissedConflict] = useState(false)

  const currentScript = activeScriptPath
    ? openScripts.find(s => s.path === activeScriptPath)
    : undefined
  const dirtyPaths = new Set(openScripts.filter(s => s.isDirty).map(s => s.path))

  const compiledLua = useMemo(() => {
    if (!project?.logicBoards?.length) return null
    return compileLogicBoard(project.logicBoards)
  }, [project?.logicBoards])

  const mainPath = project?.mainScriptPath ?? null
  const showConflict =
    !dismissedConflict &&
    !!compiledLua &&
    !!currentScript &&
    activeScriptPath === mainPath &&
    (project?.logicBoards?.length ?? 0) > 0 &&
    logicBoardScriptOutOfSync(currentScript.content, compiledLua)

  useEffect(() => {
    setDismissedConflict(false)
  }, [compiledLua])

  const handleRegenerate = () => {
    if (!compiledLua) return
    syncLogicBoardToScript(dispatch, state, compiledLua)
    setDismissedConflict(false)
  }

  return (
    <div className="h-full w-full flex-1 min-w-0 flex flex-col bg-[var(--bg)]">
      {showConflict && (
        <LogicBoardScriptConflictBanner
          onRegenerate={handleRegenerate}
          onDismiss={() => setDismissedConflict(true)}
        />
      )}

      <ScriptTabBar
        paths={openScripts.map(s => s.path)}
        activePath={activeScriptPath}
        dirtyPaths={dirtyPaths}
        onSelect={path => dispatch({ type: 'SET_ACTIVE_SCRIPT', path })}
      />

      <div className="flex-1 min-h-0 min-w-0 w-full relative bg-[var(--bg)]">
        {currentScript ? (
          <EngineScriptEditor
            key={currentScript.path}
            theme={themeMode === 'light' ? 'artcade-light' : 'artcade-dark'}
            sourceCode={currentScript.content}
            onChange={(v) =>
              dispatch({ type: 'UPDATE_SCRIPT', path: currentScript.path, content: v })
            }
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)]">
            <span className="text-[11px] uppercase tracking-widest">
              No script open
            </span>
            <span className="text-[10px] mt-1 text-[rgb(var(--muted-rgb)/0.5)]">
              Select an entity with a script in the Hierarchy panel
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
