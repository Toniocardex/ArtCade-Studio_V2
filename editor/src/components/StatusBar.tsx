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
    <footer className="h-6 bg-[#1A253A] border-t border-[#2D3748]
                       flex items-center justify-between px-3 text-[9px]
                       text-[#9CA3AF] flex-shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span className={isPlaying ? 'text-red-400' : 'text-[#00FFFF]'}>
          Runtime: {isPlaying ? 'PLAYING' : 'READY'}
        </span>
        <span>Grid: 32px</span>
        <span>Lua: 5.4</span>
        <span>Raylib: 5.0</span>
        {projectDirty && <span className="text-[#F97316]">Project: UNSAVED</span>}
      </div>
      <div className="flex items-center gap-4">
        <span>X: {cursorPos.x} Y: {cursorPos.y}</span>
        <span>Selection: {selectedName}</span>
      </div>
    </footer>
  )
}
