import { useLayoutEffect, useState, type RefObject } from 'react'

export type CanvasRulerScrollState = Readonly<{
  scrollLeft: number
  scrollTop: number
  clientWidth: number
  clientHeight: number
}>

const EMPTY: CanvasRulerScrollState = {
  scrollLeft: 0,
  scrollTop: 0,
  clientWidth: 0,
  clientHeight: 0,
}

/** Tracks scroll position and viewport size for canvas ruler tick placement. */
export function useCanvasRulerScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
): CanvasRulerScrollState {
  const [state, setState] = useState<CanvasRulerScrollState>(EMPTY)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) {
      setState(EMPTY)
      return undefined
    }

    const publish = () => {
      setState({
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
      })
    }

    publish()
    el.addEventListener('scroll', publish, { passive: true })
    const ro = new ResizeObserver(() => publish())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', publish)
      ro.disconnect()
    }
  }, [scrollRef])

  return state
}
