// ---------------------------------------------------------------------------
// CanvasToolbar — horizontal tool palette above the preview canvas
// ---------------------------------------------------------------------------
//
// Sits as a normal flex item at the top of PreviewPanel (no absolute
// positioning), so it never overlaps the canvas. Layout:
//
//   [ select | pan ] · [ paint | erase | tile ] · [ guides ]        [ status ]
//
// Tools are grouped by purpose (navigation · painting · view options), each
// group separated by a thin vertical divider. Order matches the original
// vertical palette so muscle memory is preserved.

import { Camera, Eraser, Grid3x3, Hand, ImageIcon, MousePointer2, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EditorTool } from '../../utils/runtime-sync-service'
import { ZoomControls } from './ZoomControls'

interface CanvasToolbarProps {
  activeTool:       EditorTool
  onSelectTool:     (tool: EditorTool) => void
  selectedTileCell: number
  showGuides:       boolean
  onToggleGuides:   () => void
  zoom:             number
  onSetZoom:        (zoom: number) => void
  onFitZoom:        () => void
  cameraPreview:    boolean
  onToggleCameraPreview: () => void
  rightSlot?:       ReactNode
}

function Divider() {
  return <div className="w-px h-5 bg-[var(--border)]" />
}

export function CanvasToolbar({
  activeTool, onSelectTool, selectedTileCell, showGuides, onToggleGuides,
  zoom, onSetZoom, onFitZoom,
  cameraPreview, onToggleCameraPreview,
  rightSlot,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5
                    border-b border-[var(--border)] bg-[var(--panel)]
                    flex-shrink-0">
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

      <Divider />

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

      {/* Phase F2: in-scene tile painting (uses the currently selected tileset cell) */}
      <button
        onClick={() => onSelectTool('tile')}
        title={`Paint selected tileset cell ${selectedTileCell === 0 ? '(empty)' : '#' + selectedTileCell}`}
        className={`p-1.5 rounded transition-colors ${
          activeTool === 'tile' ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
        }`}
      >
        <ImageIcon size={15} color={activeTool === 'tile' ? 'var(--accent-2)' : 'var(--muted)'} />
      </button>

      <Divider />

      <button
        onClick={onToggleGuides}
        title="Toggle editor guides"
        className={`p-1.5 rounded transition-colors ${
          showGuides ? 'bg-[rgb(var(--accent-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
        }`}
      >
        <Grid3x3 size={15} color={showGuides ? 'var(--accent)' : 'var(--muted)'} />
      </button>

      <button
        onClick={onToggleCameraPreview}
        title="Camera preview — clip canvas to scene viewportSize (Ctrl+8)"
        className={`p-1.5 rounded transition-colors ${
          cameraPreview
            ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]'
            : 'hover:bg-[var(--panel-3)]'
        }`}
      >
        <Camera size={15} color={cameraPreview ? 'var(--accent-2)' : 'var(--muted)'} />
      </button>

      <Divider />

      <ZoomControls zoom={zoom} onSet={onSetZoom} onFit={onFitZoom} />

      {/* Right-aligned slot: runtime status badge, future view-mode toggles, etc. */}
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
      </div>
    </div>
  )
}
