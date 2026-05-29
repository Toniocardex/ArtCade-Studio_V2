import { Minus, Plus } from 'lucide-react'
import { formatSpriteStudioZoomPercent } from './atlas-viewport'
import type { AtlasViewportState } from './useAtlasViewport'

type AtlasViewportToolbarProps = Readonly<{
  viewport: AtlasViewportState
  imgWH: { w: number; h: number } | null
  gridLabel: string
  cellLabel: string
  onSelectAll: () => void
  onClearSelection: () => void
  canEditSelection: boolean
}>

export function AtlasViewportToolbar({
  viewport,
  imgWH,
  gridLabel,
  cellLabel,
  onSelectAll,
  onClearSelection,
  canEditSelection,
}: AtlasViewportToolbarProps) {
  const { zoom, zoomMode, zoomFit, zoom100, zoomIn, zoomOut } = viewport
  const info =
    imgWH != null
      ? `${imgWH.w}×${imgWH.h} px · ${gridLabel} · ${cellLabel} · ${formatSpriteStudioZoomPercent(zoom)}${zoomMode === 'fit' ? ' (fit)' : ''}`
      : ''

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1 shrink-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--border-2)]"
          onClick={zoomFit}
          title="Fit sheet to panel"
        >
          Fit
        </button>
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--border-2)]"
          onClick={zoom100}
          title="100% zoom"
        >
          1:1
        </button>
        <button
          type="button"
          className="p-0.5 rounded border border-[var(--border)] hover:border-[var(--border-2)]"
          onClick={zoomOut}
          aria-label="Zoom out"
        >
          <Minus size={12} />
        </button>
        <span className="text-[10px] tabular-nums min-w-[3rem] text-center text-[var(--text)]">
          {formatSpriteStudioZoomPercent(zoom)}
        </span>
        <button
          type="button"
          className="p-0.5 rounded border border-[var(--border)] hover:border-[var(--border-2)]"
          onClick={zoomIn}
          aria-label="Zoom in"
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--border-2)] disabled:opacity-40"
          disabled={!canEditSelection}
          onClick={onSelectAll}
        >
          Select all
        </button>
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--border-2)] disabled:opacity-40"
          disabled={!canEditSelection}
          onClick={onClearSelection}
        >
          Clear
        </button>
      </div>
      {info ? (
        <span className="text-[9px] text-[var(--muted)] truncate flex-1 min-w-0" title={info}>
          {info}
        </span>
      ) : null}
    </div>
  )
}
