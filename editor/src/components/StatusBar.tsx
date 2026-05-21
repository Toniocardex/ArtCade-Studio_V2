import { useEditor, useConsoleLogs } from '../store/editor-store'
import { isReady as isWasmReady } from '../utils/wasm-bridge'

export default function StatusBar() {
  const { state }         = useEditor()
  const { state: volatile } = useConsoleLogs()
  const { project, selection, isPlaying, projectDirty, editorGridSize, snapToGrid, editorZoom, editorZoomMode, cameraPreview } = state
  const { cursorPos } = volatile

  const selectedName = (selection.entityId != null && project)
    ? (project.entities[selection.entityId]?.name ?? 'Unknown')
    : 'None'
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes[sceneId] : undefined

  // The cameraPreview flag in the store is the user intent. Its visual effect
  // is only present when viewport actually differs from world (otherwise the
  // clip is a no-op). Mirror that here so the pill matches reality.
  const cameraPreviewActive = !!(
    cameraPreview && scene &&
    (scene.viewportSize.x !== scene.worldSize.x ||
     scene.viewportSize.y !== scene.worldSize.y)
  )

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
        <span>X: {cursorPos.x} Y: {cursorPos.y}</span>
        <span>Selection: {selectedName}</span>
      </div>
    </footer>
  )
}
