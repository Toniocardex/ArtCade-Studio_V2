import { useMemo } from 'react'
import { useEditor, useConsoleLogs } from '../store/editor-store'
import { isReady as isWasmReady } from '../utils/wasm-bridge'

export default function StatusBar() {
  const { state, dispatch } = useEditor()
  const { state: volatile } = useConsoleLogs()
  const {
    project, selection, isPlaying, projectDirty, editorGridSize, snapToGrid,
    editorZoom, editorZoomMode, cameraPreview, consoleOpen, bottomPanelCollapsed,
    consoleAckUpToId,
  } = state
  const { cursorPos, consoleLogs } = volatile

  const selectedName = (selection.entityId != null && project)
    ? (project.entities[selection.entityId]?.name ?? 'Unknown')
    : 'None'
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes[sceneId] : undefined

  const cameraPreviewActive = !!(
    cameraPreview && scene &&
    (scene.viewportSize.x !== scene.worldSize.x ||
     scene.viewportSize.y !== scene.worldSize.y)
  )

  const issueCount = useMemo(() => {
    if (consoleOpen) return 0
    return consoleLogs.filter(
      (e) => (e.level === 'warn' || e.level === 'error') && e.id > consoleAckUpToId,
    ).length
  }, [consoleLogs, consoleOpen, consoleAckUpToId])

  function openConsole() {
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
  }

  return (
    <footer
      className="editor-statusbar flex items-center justify-between text-[9px]
                 text-[var(--muted)] flex-shrink-0 select-none"
    >
      <div className="flex items-center gap-4">
        <span className={
          isPlaying ? 'text-[var(--danger)]'
          : isWasmReady() ? 'text-[var(--accent)]'
          : 'text-[var(--muted)]'
        }>
          Runtime: {isPlaying ? 'PLAYING' : isWasmReady() ? 'READY' : 'LOADING'}
        </span>
        {scene && (
          <>
            <span>Scene: {scene.worldSize.x}x{scene.worldSize.y}</span>
            <span>Viewport: {scene.viewportSize.x}x{scene.viewportSize.y}</span>
          </>
        )}
        <span>Grid: {editorGridSize}px</span>
        {snapToGrid && <span>Snap: ON</span>}
        <span>
          Zoom: {Math.round(editorZoom * 100)}%
          {editorZoomMode === 'fit' && <span className="text-[var(--accent)]"> · FIT</span>}
        </span>
        {cameraPreviewActive && <span className="text-[var(--accent-2)]">Camera: PREVIEW</span>}
        <span>Lua: 5.4</span>
        <span>Raylib: 5.0</span>
        {projectDirty && <span className="text-[var(--warn)]">Project: UNSAVED</span>}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={openConsole}
          title="Open console (Ctrl+`)"
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
            consoleOpen && !bottomPanelCollapsed
              ? 'border-[rgb(var(--accent-rgb)/0.5)] text-[var(--accent)]'
              : 'border-transparent hover:border-[var(--border)] hover:text-[var(--text)]'
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
