import type { ImageAsset } from '../../types'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'
import type { SlicingMode } from '../../utils/spritesheet-studio'
import { DefaultPivotPanel } from './DefaultPivotPanel'

type SlicingPanelProps = Readonly<{
  asset: ImageAsset
  session: SpritesheetStudioSession
  onPatchDefaultPivot: (pivot: ImageAsset['defaultPivot']) => void
}>

const MODES: ReadonlyArray<{ id: SlicingMode; label: string }> = [
  { id: 'cell', label: 'Cell size' },
  { id: 'layout', label: 'Grid' },
  { id: 'strip', label: 'Frame strip' },
]

export function SlicingPanel({ asset, session, onPatchDefaultPivot }: SlicingPanelProps) {
  const {
    slicingMode,
    setSlicingMode,
    cellW,
    cellH,
    setCellW,
    setCellH,
    gridCols,
    gridRows,
    setGridCols,
    setGridRows,
    stripFrameCount,
    setStripFrameCount,
    stripAxis,
    setStripAxis,
    grid,
    gridWarning,
    imgWH,
  } = session

  const { effectiveCellW, effectiveCellH } = session

  return (
    <div className="flex flex-col gap-3 p-3 border-r border-[var(--border)] min-w-[160px] max-w-[200px] overflow-y-auto">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Slicing</p>

      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Slicing mode">
        {MODES.map((m) => (
          <label
            key={m.id}
            className="flex items-center gap-2 text-[10px] text-[var(--text)] cursor-pointer"
          >
            <input
              type="radio"
              name="slicing-mode"
              checked={slicingMode === m.id}
              onChange={() => setSlicingMode(m.id)}
            />
            {m.label}
          </label>
        ))}
      </div>

      {slicingMode === 'cell' ? (
        <>
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
        </>
      ) : null}

      {slicingMode === 'layout' ? (
        <>
          <label className="text-[10px] text-[var(--muted)]">
            Columns
            <input
              type="number"
              min={1}
              className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
              value={gridCols}
              onChange={(e) => setGridCols(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </label>
          <label className="text-[10px] text-[var(--muted)]">
            Rows
            <input
              type="number"
              min={1}
              className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
              value={gridRows}
              onChange={(e) => setGridRows(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </label>
        </>
      ) : null}

      {slicingMode === 'strip' ? (
        <>
          <label className="text-[10px] text-[var(--muted)]">
            Frame count
            <input
              type="number"
              min={1}
              className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
              value={stripFrameCount}
              onChange={(e) =>
                setStripFrameCount(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
              }
            />
          </label>
          <label className="text-[10px] text-[var(--muted)]">
            Direction
            <select
              className="mt-1 w-full bg-[var(--bg)] border border-[var(--border-2)] rounded px-2 py-1"
              value={stripAxis}
              onChange={(e) => setStripAxis(e.target.value as 'horizontal' | 'vertical')}
            >
              <option value="horizontal">Horizontal strip</option>
              <option value="vertical">Vertical strip</option>
            </select>
          </label>
        </>
      ) : null}

      <dl className="text-[10px] text-[var(--muted)] space-y-1 border-t border-[var(--border)] pt-2">
        {imgWH ? (
          <div className="flex justify-between gap-2">
            <dt>Sheet</dt>
            <dd className="text-[var(--text)] tabular-nums">
              {imgWH.w}×{imgWH.h}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt>Grid</dt>
          <dd className="text-[var(--text)] tabular-nums">
            {grid.cols} × {grid.rows}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Cell</dt>
          <dd className="text-[var(--text)] tabular-nums">
            {effectiveCellW} × {effectiveCellH}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Frames</dt>
          <dd className="text-[var(--text)] tabular-nums">{grid.totalFrames}</dd>
        </div>
      </dl>

      {gridWarning ? (
        <p className="text-[9px] text-[var(--warn)]">{gridWarning}</p>
      ) : null}

      <DefaultPivotPanel asset={asset} onPatchDefaultPivot={onPatchDefaultPivot} />
    </div>
  )
}
