import type { Vec2 } from '../../types'

export const PIVOT_MARKER_TEST_ID = 'sprite-pivot-marker'

/** Normalized pivot (0–1) → pixel offset inside a rectangle. */
export function pivotOffsetInRect(
  pivot: Vec2,
  width: number,
  height: number,
): Readonly<{ left: number; top: number }> {
  return {
    left: pivot.x * width,
    top: pivot.y * height,
  }
}

type PivotMarkerProps = Readonly<{
  left: number
  top: number
  /** Visual radius in CSS pixels (crosshair arm length). */
  radius?: number
}>

/** Crosshair anchor marker; parent must be `position: relative`. */
export function PivotMarker({ left, top, radius = 6 }: PivotMarkerProps) {
  const arm = radius
  const dot = Math.max(3, Math.round(radius * 0.45))
  return (
    <div
      data-testid={PIVOT_MARKER_TEST_ID}
      className="absolute pointer-events-none z-20"
      style={{ left, top, transform: 'translate(-50%, -50%)' }}
      aria-hidden
    >
      <div
        className="absolute rounded-full border-2 border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.35)]"
        style={{
          width: dot,
          height: dot,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <div
        className="absolute bg-[var(--accent)]"
        style={{ width: arm * 2 + 1, height: 1, left: -arm, top: 0 }}
      />
      <div
        className="absolute bg-[var(--accent)]"
        style={{ width: 1, height: arm * 2 + 1, left: 0, top: -arm }}
      />
    </div>
  )
}

type PivotGridOverlayProps = Readonly<{
  pivot: Vec2
  cols: number
  rows: number
  totalFrames: number
  cellWidth: number
  cellHeight: number
}>

/** One pivot marker per grid cell (same normalized anchor in each frame cell). */
export function PivotGridOverlay({
  pivot,
  cols,
  rows,
  totalFrames,
  cellWidth,
  cellHeight,
}: PivotGridOverlayProps) {
  if (cellWidth <= 0 || cellHeight <= 0 || totalFrames <= 0) return null

  const markers: { key: string; left: number; top: number }[] = []
  for (let i = 0; i < totalFrames; i += 1) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const { left, top } = pivotOffsetInRect(pivot, cellWidth, cellHeight)
    markers.push({
      key: `${col}-${row}`,
      left: col * cellWidth + left,
      top: row * cellHeight + top,
    })
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10" data-testid="sprite-pivot-grid-overlay">
      {markers.map((m) => (
        <PivotMarker key={m.key} left={m.left} top={m.top} radius={5} />
      ))}
    </div>
  )
}
