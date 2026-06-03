import {
  Eraser,
  Grid3x3,
  Hand,
  ImageIcon,
  MousePointer2,
  Pencil,
} from 'lucide-react'
import type { EditorTool } from '../../utils/runtime-sync-service'

type CanvasToolRailProps = Readonly<{
  activeTool: EditorTool
  onSelectTool: (tool: EditorTool) => void
  showGuides: boolean
  onToggleGuides: () => void
}>

const TOOL_ITEMS: ReadonlyArray<{
  id: EditorTool
  label: string
  icon: typeof MousePointer2
}> = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pan', label: 'Move view', icon: Hand },
  { id: 'paint', label: 'Brush', icon: Pencil },
  { id: 'erase', label: 'Eraser', icon: Eraser },
  { id: 'tile', label: 'Tile', icon: ImageIcon },
]

/** Mockup-style vertical tool rail, separate from the scene/assets column. */
export function CanvasToolRail({
  activeTool,
  onSelectTool,
  showGuides,
  onToggleGuides,
}: CanvasToolRailProps) {
  return (
    <nav className="editor-tool-rail" aria-label="Canvas tools">
      {TOOL_ITEMS.map(({ id, label, icon: Icon }) => {
        const active = activeTool === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            title={label}
            className={`editor-tool-rail__button ${active ? 'editor-tool-rail__button--active' : ''}`}
            onClick={() => onSelectTool(id)}
          >
            <Icon size={15} aria-hidden />
            <span>{label}</span>
          </button>
        )
      })}
      <div className="editor-tool-rail__separator" />
      <button
        type="button"
        aria-pressed={showGuides}
        title="Grid and guides"
        className={`editor-tool-rail__button ${showGuides ? 'editor-tool-rail__button--active' : ''}`}
        onClick={onToggleGuides}
      >
        <Grid3x3 size={15} aria-hidden />
        <span>Grid</span>
      </button>
    </nav>
  )
}
