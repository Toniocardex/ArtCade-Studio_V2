// ---------------------------------------------------------------------------
// CanvasPreview — proportional sketch of the World rect with the Viewport
// (camera window) nested inside it, so their size relationship is visible.
// ---------------------------------------------------------------------------

export type CanvasPreviewProps = Readonly<{
  worldWidth: number
  worldHeight: number
  viewportWidth: number
  viewportHeight: number
}>

const BOX_W = 96
const BOX_H = 60

export function CanvasPreview({
  worldWidth, worldHeight, viewportWidth, viewportHeight,
}: CanvasPreviewProps) {
  const safeWorldW = Math.max(worldWidth, 1)
  const safeWorldH = Math.max(worldHeight, 1)

  // Fit the world rect inside the fixed preview box, preserving its ratio.
  const scale = Math.min(BOX_W / safeWorldW, BOX_H / safeWorldH)
  const worldW = safeWorldW * scale
  const worldH = safeWorldH * scale

  // Viewport clamped to the world rect (camera cannot exceed the world here).
  const vpW = Math.min(viewportWidth, safeWorldW) * scale
  const vpH = Math.min(viewportHeight, safeWorldH) * scale

  return (
    <div
      className="flex items-center justify-center rounded bg-[var(--panel-3)] border border-[var(--border)] mb-2"
      style={{ height: BOX_H + 16 }}
      aria-hidden
    >
      <div
        className="relative border border-[var(--border-2)] bg-[var(--panel)]"
        style={{ width: worldW, height: worldH }}
      >
        <div
          className="absolute border border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.12)]"
          style={{
            width: vpW,
            height: vpH,
            left: (worldW - vpW) / 2,
            top: (worldH - vpH) / 2,
          }}
        />
      </div>
    </div>
  )
}
