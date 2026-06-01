import type { CSSProperties, ReactNode, RefObject } from 'react'

export type CanvasViewportWithRulersProps = Readonly<{
  scrollRef: RefObject<HTMLDivElement | null>
  zoom: number
  worldWidth: number
  worldHeight: number
  children: ReactNode
  className?: string
  style?: CSSProperties
  onWheel?: (e: React.WheelEvent<HTMLDivElement>) => void
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void
}>

const RULER_SIZE = 20
const TICK_STEP = 64

function ticksForAxis(length: number, zoom: number): number[] {
  const scaled = length * zoom
  const count = Math.min(24, Math.max(4, Math.ceil(scaled / TICK_STEP)))
  return Array.from({ length: count + 1 }, (_, i) => i * TICK_STEP)
}

export function CanvasViewportWithRulers({
  scrollRef,
  zoom,
  worldWidth,
  worldHeight,
  children,
  className = '',
  style,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CanvasViewportWithRulersProps) {
  const xTicks = ticksForAxis(worldWidth, zoom)
  const yTicks = ticksForAxis(worldHeight, zoom)

  return (
    <div className="flex-1 flex min-h-0 min-w-0">
      <div className="flex flex-col shrink-0" style={{ width: RULER_SIZE }}>
        <div className="canvas-ruler-corner shrink-0" style={{ height: RULER_SIZE }} aria-hidden />
        <div className="flex-1 overflow-hidden canvas-ruler-v" aria-hidden>
          {yTicks.map((px) => (
            <div
              key={px}
              className="canvas-ruler-tick-v relative border-b border-[var(--outline-subtle)]"
              style={{ height: Math.max(16, Math.round(TICK_STEP * zoom)) }}
            >
              <span className="absolute top-0 left-0 text-[7px] font-mono text-[var(--muted)] leading-none">
                {px}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div
          className="canvas-ruler-h shrink-0 flex overflow-hidden border-b border-[var(--outline-subtle)]"
          style={{ height: RULER_SIZE }}
          aria-hidden
        >
          {xTicks.map((px) => (
            <div
              key={px}
              className="canvas-ruler-tick-h relative shrink-0 border-r border-[var(--outline-subtle)]"
              style={{ width: Math.max(24, Math.round(TICK_STEP * zoom)) }}
            >
              <span className="absolute bottom-0.5 left-1 text-[7px] font-mono text-[var(--muted)]">
                {px}
              </span>
            </div>
          ))}
        </div>
        <div
          ref={scrollRef}
          tabIndex={-1}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={`flex-1 overflow-auto p-2 canvas-scrollarea outline-none ${className}`.trim()}
          style={style}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
