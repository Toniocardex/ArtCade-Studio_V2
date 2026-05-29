import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react'

const STORAGE_KEY = 'artcade-spritesheet-studio-pos'

type PanelPos = Readonly<{ x: number; y: number }>

function loadStoredPos(): PanelPos | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y }
  } catch {
    /* ignore */
  }
  return null
}

function clampPos(x: number, y: number, panelW: number, panelH: number): PanelPos {
  const margin = 24
  const maxX = Math.max(margin, window.innerWidth - margin)
  const maxY = Math.max(margin, window.innerHeight - margin)
  return {
    x: Math.min(Math.max(x, margin - panelW * 0.85), maxX - panelW * 0.15),
    y: Math.min(Math.max(y, margin), maxY - panelH * 0.15),
  }
}

/** Default modal placement: centered on the viewport (clamped to stay on-screen). */
export function centerPanelPosition(panelW: number, panelH: number): PanelPos {
  return clampPos(
    (window.innerWidth - panelW) / 2,
    (window.innerHeight - panelH) / 2,
    panelW,
    panelH,
  )
}

export function clearStoredPanelPosition(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function useDraggablePanel(
  panelRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): Readonly<{
  pos: PanelPos | null
  panelStyle: CSSProperties | undefined
  resetPosition: () => void
  headerPointerProps: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void
  }
}> {
  const [pos, setPos] = useState<PanelPos | null>(loadStoredPos)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  )

  useLayoutEffect(() => {
    if (!enabled || pos != null) return
    const el = panelRef.current
    if (!el) return
    setPos(centerPanelPosition(el.offsetWidth, el.offsetHeight))
  }, [enabled, pos, panelRef])

  const resetPosition = useCallback(() => {
    clearStoredPanelPosition()
    const el = panelRef.current
    if (!el) {
      setPos(null)
      return
    }
    setPos(centerPanelPosition(el.offsetWidth, el.offsetHeight))
  }, [panelRef])

  useEffect(() => {
    if (!enabled || !pos) return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  }, [enabled, pos])

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return
      if ((e.target as HTMLElement).closest('button')) return
      if (!pos) return
      dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    [enabled, pos],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag) return
      const el = panelRef.current
      const w = el?.offsetWidth ?? 800
      const h = el?.offsetHeight ?? 600
      setPos(
        clampPos(
          drag.originX + (e.clientX - drag.startX),
          drag.originY + (e.clientY - drag.startY),
          w,
          h,
        ),
      )
    },
    [panelRef],
  )

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!dragRef.current) return
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      endDrag()
    },
    [endDrag],
  )

  const panelStyle: CSSProperties | undefined = pos ? { left: pos.x, top: pos.y } : undefined

  return {
    pos,
    panelStyle,
    resetPosition,
    headerPointerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
