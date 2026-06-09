import { useEffect, useMemo, useState } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import { EngineScriptEditor } from '../components/EngineScriptEditor'
import { LogicBoardScriptConflictBanner } from '../components/LogicBoardScriptConflictBanner'
import { compileProjectLogic } from '../utils/logic-board/logic-compile-service'
import { logicBoardScriptOutOfSync } from '../utils/logic-board-script-conflict'
import { LogicBoardCompileErrorBanner } from '../components/LogicBoardCompileErrorBanner'
import { syncLogicBoardToScript } from '../utils/sync-logic-board-script'

/** Tracks the <html data-theme> attribute so CodeMirror follows the app theme. */
function useThemeMode(): 'dark' | 'light' {
  const read = (): 'dark' | 'light' =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

type ScriptTabBarProps = Readonly<{
  paths: string[]
  activePath: string | null
  dirtyPaths: Set<string>
  onSelect: (path: string) => void
}>

function ScriptTabBar({ paths, activePath, dirtyPaths, onSelect }: ScriptTabBarProps) {
  return (
    <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--panel)] flex-shrink-0">
      {paths.map(p => {
        const label = p.split('/').pop() ?? p
        const active = p === activePath
        return (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] whitespace-nowrap
                        border-r border-[var(--border)] transition-colors ${
                          active
                            ? 'bg-[var(--void)] text-[var(--primary)] border-t-2 border-t-[var(--outline-focus)]'
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
  const dispatch = useEditorDispatch()
  const openScripts = useEditorSelector((s) => s.openScripts)
  const activeScriptPath = useEditorSelector((s) => s.activeScriptPath)
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const themeMode = useThemeMode()
  const [dismissedConflict, setDismissedConflict] = useState(false)

  const currentScript = activeScriptPath
    ? openScripts.find(s => s.path === activeScriptPath)
    : undefined
  const dirtyPaths = new Set(openScripts.filter(s => s.isDirty).map(s => s.path))

  const compileResult = useMemo(() => {
    if (!project?.logicBoards?.length) return null
    return compileProjectLogic(project, { projectKey: projectPath ?? undefined })
  }, [project, projectPath])
  const compiledLua = compileResult?.ok ? compileResult.lua : null
  const compileError = compileResult?.compileError ?? null

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
      {compileError && <LogicBoardCompileErrorBanner error={compileError} />}
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
              Select an entity with a script in the Scenes panel
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
