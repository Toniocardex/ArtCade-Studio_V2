import { useEffect } from 'react'
import { Paintbrush } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'

/**
 * Compact paint session indicator: active layer, brush tileset, and selected tile.
 * Clicking the tileset name toggles the inspector palette.
 */
export function PaintStatusChip() {
  const dispatch = useEditorDispatch()
  const activeLayer = useEditorSelector((s) => s.editorActiveLayer)
  const paintId = useEditorSelector((s) => s.activePaintTilesetId)
  const selectedCell = useEditorSelector((s) => s.selectedTileCell)
  const project = useEditorSelector((s) => s.project)
  const notice = useEditorSelector((s) => s.paintSourceNotice)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => {
      dispatch({ type: 'DISMISS_PAINT_SOURCE_NOTICE' })
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [notice, dispatch])

  if (!paintId) return null

  const tilesetName = project?.tilesets?.[paintId]?.name ?? paintId
  const brushLabel = selectedCell === 0 ? 'Eraser' : `Tile #${selectedCell}`

  return (
    <div className="flex items-center gap-2 min-w-0">
      {notice ? (
        <span
          key={notice}
          className="asset-flash-msg text-[10px] text-[var(--muted)] truncate max-w-[200px]"
          title={notice}
        >
          {notice}
        </span>
      ) : null}
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--border-2)]
                   bg-[var(--panel-2)] text-[10px] text-[var(--muted)] min-w-0 shrink"
        title="Active paint session"
      >
        <Paintbrush size={11} className="shrink-0 text-[var(--accent)]" />
        <span className="truncate">
          Layer: <span className="text-[var(--text)]">{activeLayer}</span>
          {' · '}
          Painting:{' '}
          <button
            type="button"
            onClick={() => dispatch({ type: 'TILESET_TOGGLE_PALETTE' })}
            className="text-[var(--accent)] hover:underline"
          >
            {tilesetName}
          </button>
          {' · '}
          <span className="text-[var(--text)]">{brushLabel}</span>
        </span>
      </div>
    </div>
  )
}
