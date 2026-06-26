import { useLayoutEffect, useState, type RefObject } from 'react'

export type CanvasViewportSize = Readonly<{
  clientWidth: number
  clientHeight: number
}>

const EMPTY: CanvasViewportSize = { clientWidth: 0, clientHeight: 0 }

/** Tracks the fixed editor canvas viewport size (no DOM scroll — Phase 6). */
export function useCanvasViewportSize(
  viewportRef: RefObject<HTMLDivElement | null>,
): CanvasViewportSize {
  const [size, setSize] = useState<CanvasViewportSize>(EMPTY)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) {
      setSize(EMPTY)
      return undefined
    }

    const publish = () => {
      setSize((prev) =>
        prev.clientWidth === el.clientWidth && prev.clientHeight === el.clientHeight
          ? prev
          : { clientWidth: el.clientWidth, clientHeight: el.clientHeight },
      )
    }

    publish()
    const ro = new ResizeObserver(() => publish())
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewportRef])

  return size
}
