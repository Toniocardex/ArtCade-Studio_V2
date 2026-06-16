import { useEffect, useMemo, useState } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import { EngineScriptEditor } from '../components/EngineScriptEditor'
import { compileProjectLogic } from '../utils/logic-board/logic-compile-service'
import { LogicBoardCompileErrorBanner } from '../components/LogicBoardCompileErrorBanner'
import { composeProjectLua } from '../utils/project-lua-composer'
import type { MainScriptView } from '../store/editor-store-state'
import { resolveScriptEditorEmptyHint } from '../utils/script-editor-activation'

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
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
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
  const mainScriptView = useEditorSelector((s) => s.mainScriptView)
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const selectionEntityId = useEditorSelector((s) => s.selection.entityId)
  const openScriptPathsKey = useEditorSelector((s) =>
    s.openScripts.map((script) => script.path).join('\0'),
  )
  const themeMode = useThemeMode()

  const currentScript = activeScriptPath
    ? openScripts.find(s => s.path === activeScriptPath)
    : undefined
  const dirtyPaths = new Set(openScripts.filter(s => s.isDirty).map(s => s.path))
  const emptyStateHint = useMemo(() => {
    const openScriptPaths = openScriptPathsKey.length > 0
      ? openScriptPathsKey.split('\0')
      : []
    return resolveScriptEditorEmptyHint({
      project,
      projectPath,
      selectionEntityId,
      openScriptPaths,
    })
  }, [project, projectPath, selectionEntityId, openScriptPathsKey])

  const compileResult = useMemo(() => {
    if (!project?.logicBoards?.length) return null
    return compileProjectLogic(project, { projectKey: projectPath ?? undefined })
  }, [project, projectPath])
  const hasLogicBoards = (project?.logicBoards?.length ?? 0) > 0
  const generatedLua = hasLogicBoards ? (compileResult?.lua ?? '') : ''
  const compileError = compileResult?.compileError ?? null

  const mainPath = project?.mainScriptPath ?? null
  const isMainScript = !!currentScript && activeScriptPath === mainPath
  const composed = useMemo(
    () => composeProjectLua({
      manualLua: isMainScript ? currentScript.content : '',
      generatedLua,
      projectKey: projectPath,
    }),
    [currentScript?.content, generatedLua, isMainScript, projectPath],
  )
  const displayedSource = !isMainScript || mainScriptView === 'manual'
    ? currentScript?.content ?? ''
    : mainScriptView === 'generated'
      ? generatedLua
      : composed.combinedLua
  const readOnly = isMainScript && mainScriptView !== 'manual'

  const selectMainView = (view: MainScriptView) => {
    dispatch({ type: 'SET_MAIN_SCRIPT_VIEW', view })
  }

  return (
    <div className="h-full w-full flex-1 min-w-0 flex flex-col bg-[var(--bg)]">
      {compileError && <LogicBoardCompileErrorBanner error={compileError} />}

      <ScriptTabBar
        paths={openScripts.map(s => s.path)}
        activePath={activeScriptPath}
        dirtyPaths={dirtyPaths}
        onSelect={path => dispatch({ type: 'SET_ACTIVE_SCRIPT', path })}
      />

      {isMainScript && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--panel)]">
          {([
            ['manual', 'My Script'],
            ['generated', 'Logic Board'],
            ['combined', 'Combined Preview'],
          ] as const).map(([view, label]) => (
            <button
              key={view}
              type="button"
              onClick={() => selectMainView(view)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                mainScriptView === view
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-fg-on-bg)] border border-[var(--accent-bd)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)] border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-[var(--muted)]">
            {readOnly
              ? 'Read-only preview generated by ArtCade'
              : 'Edit My Script. Logic Board code is generated automatically.'}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 min-w-0 w-full relative bg-[var(--bg)]">
        {currentScript ? (
          <EngineScriptEditor
            key={currentScript.path}
            theme={themeMode === 'light' ? 'artcade-light' : 'artcade-dark'}
            sourceCode={displayedSource}
            readOnly={readOnly}
            onChange={(v) =>
              !readOnly && dispatch({ type: 'UPDATE_SCRIPT', path: currentScript.path, content: v })
            }
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)]">
            <span className="text-[11px] uppercase tracking-widest">
              No script active
            </span>
            <span className="text-[10px] mt-1 text-[rgb(var(--muted-rgb)/0.5)]">
              {emptyStateHint}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
