import { useEditor, useConsoleLogs } from '../store/editor-store'

export default function StatusBar() {
  const { state }         = useEditor()
  const { state: volatile } = useConsoleLogs()
  const { project, selection, isPlaying, projectDirty } = state
  const { cursorPos } = volatile

  const selectedName = (selection.entityId != null && project)
    ? (project.entities[selection.entityId]?.name ?? 'Unknown')
    : 'None'

  return (
    <footer className="h-6 bg-[var(--panel)] border-t border-[var(--border)]
                       flex items-center justify-between px-3 text-[9px]
                       text-[var(--muted)] flex-shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span className={isPlaying ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}>
          Runtime: {isPlaying ? 'PLAYING' : 'READY'}
        </span>
        <span>Grid: 32px</span>
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
