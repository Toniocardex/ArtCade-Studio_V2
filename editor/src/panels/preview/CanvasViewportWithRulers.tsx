import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useCanvasRulerScroll } from '../../hooks/useCanvasRulerScroll'
import {
  pickRulerTickStep,
  rulerLabelsForAxis,
  type CanvasViewportLayout,
} from '../../utils/canvas-viewport-layout'

export type CanvasViewportWithRulersProps = Readonly<{
  scrollRef: RefObject<HTMLDivElement | null>
  layout: CanvasViewportLayout
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

function RulerTicksH({
  layout,
  scrollLeft,
  clientWidth,
}: Readonly<{
  layout: CanvasViewportLayout
  scrollLeft: number
  clientWidth: number
}>) {
  const ticks = rulerLabelsForAxis('x', scrollLeft, clientWidth, layout)
  const stepPx = Math.max(24, Math.round(pickRulerTickStep(layout.zoom) * layout.zoom))

  return (
    <>
      {ticks.map(({ worldValue, positionPx }) => (
        <div
          key={worldValue}
          className="canvas-ruler-tick-h absolute top-0 bottom-0 border-r border-[var(--outline-subtle)] pointer-events-none"
          style={{ left: positionPx, width: stepPx }}
        >
          <span className="absolute bottom-0.5 left-1 text-[8px] font-mono text-[var(--primary-soft)] leading-none">
            {worldValue}
          </span>
        </div>
      ))}
    </>
  )
}

function RulerTicksV({
  layout,
  scrollTop,
  clientHeight,
}: Readonly<{
  layout: CanvasViewportLayout
  scrollTop: number
  clientHeight: number
}>) {
  const ticks = rulerLabelsForAxis('y', scrollTop, clientHeight, layout)
  const stepPx = Math.max(16, Math.round(pickRulerTickStep(layout.zoom) * layout.zoom))

  return (
    <>
      {ticks.map(({ worldValue, positionPx }) => (
        <div
          key={worldValue}
          className="canvas-ruler-tick-v absolute left-0 right-0 border-b border-[var(--outline-subtle)] pointer-events-none"
          style={{ top: positionPx, height: stepPx }}
        >
          <span className="absolute top-0 left-0.5 text-[8px] font-mono text-[var(--primary-soft)] leading-none">
            {worldValue}
          </span>
        </div>
      ))}
    </>
  )
}

export function CanvasViewportWithRulers({
  scrollRef,
  layout,
  children,
  className = '',
  style,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CanvasViewportWithRulersProps) {
  const { scrollLeft, scrollTop, clientWidth, clientHeight } = useCanvasRulerScroll(scrollRef)
  const pad = layout.paddingPx

  return (
    <div className="flex-1 flex min-h-0 min-w-0 canvas-viewport-rulers">
      <div className="flex flex-col shrink-0" style={{ width: RULER_SIZE }}>
        <div className="canvas-ruler-corner shrink-0" style={{ height: RULER_SIZE }} aria-hidden />
        <div
          className="flex-1 relative overflow-hidden canvas-ruler-v"
          style={{ width: RULER_SIZE }}
          aria-hidden
        >
          <RulerTicksV layout={layout} scrollTop={scrollTop} clientHeight={clientHeight} />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div
          className="canvas-ruler-h shrink-0 relative overflow-hidden border-b border-[var(--outline-subtle)]"
          style={{ height: RULER_SIZE }}
          aria-hidden
        >
          <RulerTicksH layout={layout} scrollLeft={scrollLeft} clientWidth={clientWidth} />
        </div>
        <div
          ref={scrollRef}
          tabIndex={-1}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={`flex-1 overflow-auto canvas-scrollarea outline-none ${className}`.trim()}
          style={{ padding: pad, ...style }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
