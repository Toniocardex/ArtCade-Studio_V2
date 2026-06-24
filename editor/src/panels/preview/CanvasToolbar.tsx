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
// group separated by a thin vertical divider.

import { Camera, Grid3x3, Hand, Maximize2, MousePointer2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { EditorTool } from '../../utils/runtime-sync-service'
import { ZoomControls } from './ZoomControls'
import { ActiveLayerSelect } from './ActiveLayerSelect'
import { PaintStatusChip } from './PaintStatusChip'
import { ViewportOptionsPopover } from './ViewportOptionsPopover'

interface CanvasToolbarProps {
  activeTool:       EditorTool
  onSelectTool:     (tool: EditorTool) => void
  showToolPalette?: boolean
  rightSlot?:       ReactNode
}

function Divider() {
  return <div className="w-px h-5 bg-[var(--border)]" />
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
  activeTool, onSelectTool,
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
            { id: 'select', Icon: MousePointer2, title: 'Select / move entities. Alt+click cycles overlapping objects.' },
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

      <ViewportOptionsPopover />

      <Divider />

      <CameraPreviewToggle />

      <Divider />

      <ActiveLayerSelect />

      <Divider />

      <PaintStatusChip />

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
