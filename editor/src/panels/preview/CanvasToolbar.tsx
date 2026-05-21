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
import { useEditor } from '../../store/editor-store'
import type { EditorTool } from '../../utils/runtime-sync-service'
import { ZoomControls } from './ZoomControls'

// The toolbar owns tool / guides state (local to PreviewPanel) and a free
// right slot. Everything else (zoom, camera preview) is store-driven and
// rendered by the dedicated child components below so we don't drill 11 props
// through this file (TECHNICAL_DEBT_REVIEW §13).
interface CanvasToolbarProps {
  activeTool:       EditorTool
  onSelectTool:     (tool: EditorTool) => void
  selectedTileCell: number
  showGuides:       boolean
  onToggleGuides:   () => void
  rightSlot?:       ReactNode
}

function Divider() {
  return <div className="w-px h-5 bg-[var(--border)]" />
}

/**
 * Self-contained toggle that mirrors the store's `cameraPreview` flag.
 * Kept inline in CanvasToolbar because it has no other call sites — moving
 * it into its own file would add fragmentation without any reuse benefit.
 */
function CameraPreviewToggle() {
  const { state, dispatch } = useEditor()
  const enabled = state.cameraPreview
  return (
    <button
      onClick={() => dispatch({ type: 'EDITOR_SET_CAMERA_PREVIEW', enabled: !enabled })}
      title="Camera preview — clip canvas to scene viewportSize (Ctrl+8)"
      className={`p-1.5 rounded transition-colors ${
        enabled ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
      }`}
    >
      <Camera size={15} color={enabled ? 'var(--accent-2)' : 'var(--muted)'} />
    </button>
  )
}

export function CanvasToolbar({
  activeTool, onSelectTool, selectedTileCell, showGuides, onToggleGuides,
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

      <CameraPreviewToggle />

      <Divider />

      <ZoomControls />

      {/* Right-aligned slot: runtime status badge, future view-mode toggles, etc. */}
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
      </div>
    </div>
  )
}
