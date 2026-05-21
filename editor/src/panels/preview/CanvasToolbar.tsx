// ---------------------------------------------------------------------------
// CanvasToolbar — left-side tool palette overlaid on the preview canvas
// ---------------------------------------------------------------------------
//
// Extracted from PreviewPanel.tsx during Phase 6 of the technical-debt
// split. The palette is purely presentational + a tool-id callback; the
// runtime synchronisation still happens in PreviewPanel via
// useRuntimeEditorSync, so this component owns no side effects.

import { Eraser, Grid3x3, Hand, ImageIcon, MousePointer2, Pencil } from 'lucide-react'
import type { EditorTool } from '../../utils/runtime-sync-service'

interface CanvasToolbarProps {
  activeTool:       EditorTool
  onSelectTool:     (tool: EditorTool) => void
  selectedTileCell: number
  showGuides:       boolean
  onToggleGuides:   () => void
}

export function CanvasToolbar({
  activeTool, onSelectTool, selectedTileCell, showGuides, onToggleGuides,
}: CanvasToolbarProps) {
  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 z-40
                    bg-[var(--panel)] p-2 border border-[var(--border)] rounded-lg shadow-lg">
      {([
        { id: 'select', Icon: MousePointer2, color: 'var(--accent)', title: 'Select / move entities' },
        { id: 'pan',    Icon: Hand,           color: 'var(--muted)',  title: 'Pan camera' },
      ] as const).map(({ id, Icon, color, title }) => (
        <button
          key={id}
          onClick={() => onSelectTool(id)}
          title={title}
          className={`p-1.5 rounded transition-colors ${
            activeTool === id ? 'bg-[rgb(var(--accent-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
          }`}
        >
          <Icon size={15} color={activeTool === id ? color : 'var(--muted)'} />
        </button>
      ))}

      <div className="h-px w-full bg-[var(--border)]" />

      {([
        { id: 'paint', Icon: Pencil, title: 'Paint tiles' },
        { id: 'erase', Icon: Eraser, title: 'Erase tiles' },
      ] as const).map(({ id, Icon, title }) => (
        <button
          key={id}
          onClick={() => onSelectTool(id)}
          title={title}
          className={`p-1.5 rounded transition-colors ${
            activeTool === id ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
          }`}
        >
          <Icon size={15} color={activeTool === id ? 'var(--accent-2)' : 'var(--muted)'} />
        </button>
      ))}

      <div className="h-px w-full bg-[var(--border)]" />

      {/* Phase F2: in-scene tile painting */}
      <button
        onClick={() => onSelectTool('tile')}
        title={`Paint selected tileset cell ${selectedTileCell === 0 ? '(empty)' : '#' + selectedTileCell}`}
        className={`p-1.5 rounded transition-colors ${
          activeTool === 'tile' ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
        }`}
      >
        <ImageIcon size={15} color={activeTool === 'tile' ? 'var(--accent-2)' : 'var(--muted)'} />
      </button>

      <div className="h-px w-full bg-[var(--border)]" />

      <button
        onClick={onToggleGuides}
        title="Toggle editor guides"
        className={`p-1.5 rounded transition-colors ${
          showGuides ? 'bg-[rgb(var(--accent-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
        }`}
      >
        <Grid3x3 size={15} color={showGuides ? 'var(--accent)' : 'var(--muted)'} />
      </button>
    </div>
  )
}
