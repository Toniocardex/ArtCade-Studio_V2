import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useEditorDispatch, useEditorSelector, useConsoleLogs } from '../store/editor-store'
import { DEFAULT_WORLD } from '../types'
import { getProjectWorkbenchSnapshot } from '../utils/project-health'
import { useRuntimeProfilePoll } from '../hooks/useRuntimeProfilePoll'
import { useRuntimeReadiness } from '../hooks/useRuntimeReadiness'

function runtimeDisplay(playing: boolean, wasmReady: boolean): { text: string; className: string } {
  if (playing) {
    return { text: 'PLAYING', className: 'text-[var(--danger)]' }
  }
  if (wasmReady) {
    return { text: 'READY', className: 'text-[var(--text)]' }
  }
  return { text: 'LOADING', className: 'text-[var(--muted)]' }
}

type StatusBarProps = Readonly<{
  compact?: boolean
}>

export default function StatusBar({ compact = false }: StatusBarProps) {
  const dispatch = useEditorDispatch()
  const { wasmReady } = useRuntimeReadiness()
  const { state: volatile } = useConsoleLogs()
  const project = useEditorSelector((s) => s.project)
  const selection = useEditorSelector((s) => s.selection)
  const isPlaying = useEditorSelector((s) => s.isPlaying)
  const projectDirty = useEditorSelector((s) => s.projectDirty)
  const editorGridSize = useEditorSelector((s) => s.editorGridSize)
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)
  const editorZoom = useEditorSelector((s) => s.editorZoom)
  const editorZoomMode = useEditorSelector((s) => s.editorZoomMode)
  const cameraPreview = useEditorSelector((s) => s.cameraPreview)
  const bottomPanelCollapsed = useEditorSelector((s) => s.bottomPanelCollapsed)
  const consoleAckUpToId = useEditorSelector((s) => s.consoleAckUpToId)
  const dockPanelVisibility = useEditorSelector((s) => s.dockPanelVisibility)
  const consoleOpen = useEditorSelector((s) => s.consoleOpen)
  const openScripts = useEditorSelector((s) => s.openScripts)
  const { cursorPos, consoleLogs } = volatile

  const selectedName = (selection.entityId != null && project)
    ? (project.entities?.[selection.entityId]?.name ?? 'Unknown')
    : 'None'
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes?.[sceneId] : undefined

  const cameraPreviewActive = !!(
    cameraPreview && scene &&
    (scene.viewportSize.x !== scene.worldSize.x ||
     scene.viewportSize.y !== scene.worldSize.y)
  )

  const validationIssues = useMemo(
    () => getProjectWorkbenchSnapshot({
      project,
      openScripts,
      includeCompile: false,
    }).health,
    [project, openScripts],
  )

  const showRuntimeStats = { ...DEFAULT_WORLD, ...project?.world }.showRuntimeStats === true
  const runtimeProfile = useRuntimeProfilePoll(showRuntimeStats, isPlaying)

  const dockShowsConsoleIssues =
    !bottomPanelCollapsed && dockPanelVisibility.console

  const issueCount = useMemo(() => {
    const validationCount =
      validationIssues.errors.length + validationIssues.warnings.length
    if (dockShowsConsoleIssues) {
      return validationCount
    }
    const consoleCount = consoleLogs.filter(
      (e) => (e.level === 'warn' || e.level === 'error') && e.id > consoleAckUpToId,
    ).length
    return validationCount + consoleCount
  }, [
    consoleLogs,
    dockShowsConsoleIssues,
    consoleAckUpToId,
    validationIssues,
  ])

  function toggleConsole() {
    dispatch({ type: 'TOGGLE_CONSOLE' })
  }

  const runtime = runtimeDisplay(isPlaying, wasmReady)

  const consoleActive = !bottomPanelCollapsed && consoleOpen

  if (compact) {
    const runtimeCompact = runtimeDisplay(isPlaying, wasmReady)
    return (
      <footer
        className="editor-statusbar flex items-center justify-between text-[9px]
                   text-[var(--muted)] flex-shrink-0 select-none"
      >
        <span className={runtimeCompact.className}>Runtime: {runtimeCompact.text}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono">X: {cursorPos.x} Y: {cursorPos.y}</span>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className="editor-statusbar flex items-center justify-between text-[9px]
                 text-[var(--muted)] flex-shrink-0 select-none"
    >
      <div className="flex items-center gap-4">
        <span className={runtime.className}>
          Runtime: {runtime.text}
        </span>
        {scene && (
          <>
            <span>Scene: {scene.worldSize.x}x{scene.worldSize.y}</span>
            <span>Viewport: {scene.viewportSize.x}x{scene.viewportSize.y}</span>
          </>
        )}
        <span>Grid: {editorGridSize}px</span>
        <span>Snap: {snapToGrid ? 'ON' : 'OFF'}</span>
        <span>
          Zoom: {Math.round(editorZoom * 100)}%
          {editorZoomMode === 'fit' && <span className="text-[var(--text)]"> · FIT</span>}
        </span>
        {cameraPreviewActive && <span className="text-[var(--text)]">Camera: PREVIEW</span>}
        {isPlaying && showRuntimeStats && runtimeProfile.fps > 0 && (
          <span title="Lua / physics / render ms (last frame)">
            FPS: {Math.round(runtimeProfile.fps)}
            {' · '}
            Lua {runtimeProfile.luaMs.toFixed(1)}ms
            {' · '}
            Phys {runtimeProfile.physicsMs.toFixed(1)}ms
            {' · '}
            Draw {runtimeProfile.renderMs.toFixed(1)}ms
            {' · '}
            Ent {Math.round(runtimeProfile.entityCount)}
          </span>
        )}
        <span>Lua: 5.4</span>
        <span>Raylib: 5.0</span>
        {projectDirty ? (
          <span className="text-[var(--warn)]">Project: UNSAVED</span>
        ) : project ? (
          <span
            className="inline-flex items-center gap-1 text-[var(--text)]"
            title="All edits are saved in memory; use File → Save Project to write to disk"
          >
            <Check size={11} className="text-[var(--accent)]" aria-hidden />
            No unsaved changes
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleConsole}
          title="Toggle console panel (Ctrl+`)"
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
            consoleActive
              ? 'bg-[rgb(var(--accent-rgb)/0.18)] text-[var(--text)]'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          Console
          {issueCount > 0 && (
            <span className="inline-flex min-w-[14px] h-[14px] px-1 items-center justify-center rounded-full
                             bg-[var(--danger-2)] text-[8px] font-bold text-white leading-none">
              {issueCount > 99 ? '99+' : issueCount}
            </span>
          )}
        </button>
        <span>X: {cursorPos.x} Y: {cursorPos.y}</span>
        <span>Selection: {selectedName}</span>
      </div>
    </footer>
  )
}
