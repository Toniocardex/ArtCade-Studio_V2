import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useCanvasViewportSize } from '../../hooks/useCanvasViewportSize'
import { useEditorCameraView } from '../../hooks/useEditorCameraView'
import {
  pickRulerTickStep,
  rulerLabelsForCameraAxis,
  type CanvasViewportLayout,
} from '../../utils/canvas-viewport-layout'

export type CanvasViewportWithRulersProps = Readonly<{
  viewportRef: RefObject<HTMLDivElement | null>
  layout: CanvasViewportLayout
  /** Show the ruler strips (default true). */
  rulersVisible?: boolean
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
  cameraWorldOrigin,
  clientWidth,
}: Readonly<{
  layout: CanvasViewportLayout
  cameraWorldOrigin: Readonly<{ x: number; y: number }>
  clientWidth: number
}>) {
  const ticks = rulerLabelsForCameraAxis('x', cameraWorldOrigin, clientWidth, layout)
  const stepPx = Math.max(24, Math.round(pickRulerTickStep(layout.zoom, layout.rulerStep) * layout.zoom))

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
  cameraWorldOrigin,
  clientHeight,
}: Readonly<{
  layout: CanvasViewportLayout
  cameraWorldOrigin: Readonly<{ x: number; y: number }>
  clientHeight: number
}>) {
  const ticks = rulerLabelsForCameraAxis('y', cameraWorldOrigin, clientHeight, layout)
  const stepPx = Math.max(16, Math.round(pickRulerTickStep(layout.zoom, layout.rulerStep) * layout.zoom))

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
  viewportRef,
  layout,
  rulersVisible = true,
  children,
  className = '',
  style,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CanvasViewportWithRulersProps) {
  const { clientWidth, clientHeight } = useCanvasViewportSize(viewportRef)
  const cameraView = useEditorCameraView()
  const cameraWorldOrigin = { x: cameraView.x, y: cameraView.y }
  const pad = layout.paddingPx

  return (
    <div className="flex-1 flex min-h-0 min-w-0 canvas-viewport-rulers">
      {rulersVisible && (
        <div className="flex flex-col shrink-0" style={{ width: RULER_SIZE }}>
          <div className="canvas-ruler-corner shrink-0" style={{ height: RULER_SIZE }} aria-hidden />
          <div
            className="flex-1 relative overflow-hidden canvas-ruler-v"
            style={{ width: RULER_SIZE }}
            aria-hidden
          >
            <RulerTicksV
              layout={layout}
              cameraWorldOrigin={cameraWorldOrigin}
              clientHeight={clientHeight}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {rulersVisible && (
          <div
            className="canvas-ruler-h shrink-0 relative overflow-hidden border-b border-[var(--outline-subtle)]"
            style={{ height: RULER_SIZE }}
            aria-hidden
          >
            <RulerTicksH
              layout={layout}
              cameraWorldOrigin={cameraWorldOrigin}
              clientWidth={clientWidth}
            />
          </div>
        )}
        <div
          ref={viewportRef}
          tabIndex={-1}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={`flex-1 overflow-hidden canvas-viewport outline-none relative ${className}`.trim()}
          style={{ padding: pad, ...style }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
