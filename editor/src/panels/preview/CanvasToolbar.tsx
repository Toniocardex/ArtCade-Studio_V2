// ---------------------------------------------------------------------------
// CanvasToolbar - horizontal viewport controls above the preview canvas
// ---------------------------------------------------------------------------
//
// Sits as a normal flex item at the top of PreviewPanel (no absolute
// positioning), so it never overlaps the canvas. Layout:
//
//   [ viewport controls ] [ layer ] [ zoom ]        [ status ]
//
// Controls are grouped by purpose, each
// group separated by a thin vertical divider. Order matches the original
// vertical palette so muscle memory is preserved.

import { Camera, Eraser, Grid3x3, Hand, ImageIcon, Maximize2, MousePointer2, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { EditorTool } from '../../utils/runtime-sync-service'
import { ZoomControls } from './ZoomControls'
import { ActiveLayerSelect } from './ActiveLayerSelect'

interface CanvasToolbarProps {
  activeTool:       EditorTool
  onSelectTool:     (tool: EditorTool) => void
  selectedTileCell: number
  showToolPalette?: boolean
  rightSlot?:       ReactNode
}

function Divider() {
  return <div className="w-px h-5 bg-[var(--border)]" />
}

/** Snap-to-grid checkbox — lives next to the grid/guides toggle so the two
 *  related controls read as one group (mirrors SceneSettingsSection). */
function SnapToGridCheckbox() {
  const dispatch = useEditorDispatch()
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)
  return (
    <label
      title="Snap entities and tiles to the editor grid"
      className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer select-none
                 text-[10px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
    >
      <input
        type="checkbox"
        checked={snapToGrid}
        onChange={(e) => dispatch({ type: 'SET_SNAP_TO_GRID', enabled: e.target.checked })}
        className="accent-[var(--accent)]"
      />
      <span>Snap</span>
    </label>
  )
}

function CameraPreviewToggle() {
  const dispatch = useEditorDispatch()
  const enabled = useEditorSelector((s) => s.cameraPreview)
  return (
    <button
      onClick={() => dispatch({ type: 'EDITOR_SET_CAMERA_PREVIEW', enabled: !enabled })}
      title="Camera preview - clip canvas to scene viewportSize (Ctrl+8)"
      className={`p-1.5 rounded transition-colors ${
        enabled ? 'bg-[rgb(var(--accent-rgb)/0.18)]' : 'hover:bg-[var(--panel-3)]'
      }`}
    >
      <Camera size={15} color={enabled ? 'var(--accent)' : 'var(--muted)'} />
    </button>
  )
}

export function CanvasToolbar({
  activeTool, onSelectTool, selectedTileCell,
  showToolPalette = true,
  rightSlot,
}: CanvasToolbarProps) {
  const dispatch = useEditorDispatch()
  const showGuides = useEditorSelector((s) => s.editorGuidesVisible)

  return (
    <div className="flex items-center gap-1 px-2 py-1.5
                    border-b border-[var(--border)] bg-[var(--panel)]
                    flex-shrink-0">
      {showToolPalette && (
        <>
          {([
            { id: 'select', Icon: MousePointer2, title: 'Select / move entities' },
            { id: 'pan',    Icon: Hand,           title: 'Pan camera' },
          ] as const).map(({ id, Icon, title }) => (
            <button
              key={id}
              onClick={() => onSelectTool(id)}
              title={title}
              className={`p-1.5 rounded transition-colors ${
                activeTool === id ? 'bg-[rgb(var(--accent-rgb)/0.18)]' : 'hover:bg-[var(--panel-3)]'
              }`}
            >
              <Icon size={15} color={activeTool === id ? 'var(--accent)' : 'var(--muted)'} />
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
                activeTool === id ? 'bg-[rgb(var(--accent-rgb)/0.18)]' : 'hover:bg-[var(--panel-3)]'
              }`}
            >
              <Icon size={15} color={activeTool === id ? 'var(--accent)' : 'var(--muted)'} />
            </button>
          ))}

          <button
            onClick={() => onSelectTool('tile')}
            title={`Paint selected tileset cell ${selectedTileCell === 0 ? '(empty)' : '#' + selectedTileCell}`}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'tile' ? 'bg-[rgb(var(--accent-rgb)/0.18)]' : 'hover:bg-[var(--panel-3)]'
            }`}
          >
            <ImageIcon size={15} color={activeTool === 'tile' ? 'var(--accent)' : 'var(--muted)'} />
          </button>

          <Divider />

          <button
            onClick={() => dispatch({ type: 'TOGGLE_EDITOR_GUIDES' })}
            title="Toggle editor guides"
            className={`p-1.5 rounded transition-colors ${
              showGuides ? 'bg-[rgb(var(--accent-rgb)/0.18)]' : 'hover:bg-[var(--panel-3)]'
            }`}
          >
            <Grid3x3 size={15} color={showGuides ? 'var(--accent)' : 'var(--muted)'} />
          </button>

          <Divider />
        </>
      )}

      <SnapToGridCheckbox />

      <Divider />

      <CameraPreviewToggle />

      <Divider />

      <ActiveLayerSelect />

      <Divider />

      <ZoomControls />

      {/* Right-aligned slot: runtime status badge, future view-mode toggles, etc. */}
      <div className="ml-auto flex items-center gap-2 min-w-0 shrink">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_FOCUS_MODE', enabled: true })}
          title="Focus mode - maximize canvas (F11)"
          className="p-1.5 rounded transition-colors hover:bg-[var(--panel-3)]"
        >
          <Maximize2 size={15} color="var(--muted)" />
        </button>
        {rightSlot}
      </div>
    </div>
  )
}
