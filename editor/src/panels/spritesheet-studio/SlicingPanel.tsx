import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'

type SlicingPanelProps = Readonly<{
  session: SpritesheetStudioSession
}>

export function SlicingPanel({ session }: SlicingPanelProps) {
  const { cellW, cellH, setCellW, setCellH, grid } = session
  return (
    <div className="flex flex-col gap-3 p-3 border-r border-[var(--border)] min-w-[140px]">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Slicing</p>
      <label className="text-[10px] text-[var(--muted)]">
        Cell width
        <input
          type="number"
          min={1}
          className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
          value={cellW}
          onChange={(e) => setCellW(Math.max(1, Number.parseInt(e.target.value, 10) || 32))}
        />
      </label>
      <label className="text-[10px] text-[var(--muted)]">
        Cell height
        <input
          type="number"
          min={1}
          className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
          value={cellH}
          onChange={(e) => setCellH(Math.max(1, Number.parseInt(e.target.value, 10) || 32))}
        />
      </label>
      <dl className="text-[10px] text-[var(--muted)] space-y-1">
        <div className="flex justify-between">
          <dt>Grid</dt>
          <dd className="text-[var(--text)]">{grid.cols} × {grid.rows}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Frames</dt>
          <dd className="text-[var(--text)]">{grid.totalFrames}</dd>
        </div>
      </dl>
    </div>
  )
}
