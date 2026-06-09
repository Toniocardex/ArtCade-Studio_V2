import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'

/** Local canvas footer (mockup: grid + snap); mirrors status bar for the viewport. */
export function CanvasFooterBar() {
  const dispatch = useEditorDispatch()
  const editorGridSize = useEditorSelector((s) => s.editorGridSize)
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)

  return (
    <div
      className="shrink-0 flex items-center gap-4 px-3 py-1 border-t border-[var(--outline)]
                 bg-[var(--surface-2)] text-[9px] font-mono text-[var(--muted)]"
      data-panel="canvas-footer"
    >
      <span>Grid: {editorGridSize}px</span>
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          className="editor-checkbox"
          checked={snapToGrid}
          onChange={(e) =>
            dispatch({ type: 'SET_SNAP_TO_GRID', enabled: e.target.checked })
          }
        />
        <span className={snapToGrid ? 'text-[var(--primary)]' : ''}>
          Snap: {snapToGrid ? 'ON' : 'OFF'}
        </span>
      </label>
    </div>
  )
}
