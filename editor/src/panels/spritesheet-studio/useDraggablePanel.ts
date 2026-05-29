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
const MIN_PANEL_W = 320
const MIN_PANEL_H = 240

type PanelPos = Readonly<{ x: number; y: number }>

/** CSS max size of the studio panel — used until layout reports real dimensions. */
export function defaultPanelSize(): Readonly<{ w: number; h: number }> {
  return {
    w: Math.min(1400, Math.round(window.innerWidth * 0.96)),
    h: Math.min(820, Math.round(window.innerHeight * 0.9)),
  }
}

export function measurePanelSize(el: HTMLElement): Readonly<{ w: number; h: number }> {
  const rect = el.getBoundingClientRect()
  const fallback = defaultPanelSize()
  const w = Math.max(el.offsetWidth, rect.width, fallback.w)
  const h = Math.max(el.offsetHeight, rect.height, fallback.h)
  return { w, h }
}

/** Top-left snapped to viewport center with zero size (bad first-layout measure). */
function isCorruptCenterSnap(pos: PanelPos): boolean {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  return Math.abs(pos.x - cx) < 96 && Math.abs(pos.y - cy) < 96
}

function loadStoredPos(): PanelPos | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (typeof p.x !== 'number' || typeof p.y !== 'number') return null
    const pos = { x: p.x, y: p.y }
    if (isCorruptCenterSnap(pos)) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return pos
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

  const applyCenteredPosition = useCallback(() => {
    const el = panelRef.current
    const { w, h } = el ? measurePanelSize(el) : defaultPanelSize()
    setPos(centerPanelPosition(w, h))
  }, [panelRef])

  useLayoutEffect(() => {
    if (!enabled || pos != null) return
    const el = panelRef.current
    if (!el) return

    const place = () => {
      if (panelRef.current == null) return
      const { w, h } = measurePanelSize(panelRef.current)
      if (w < MIN_PANEL_W || h < MIN_PANEL_H) return false
      setPos(centerPanelPosition(w, h))
      return true
    }

    if (place()) return
    const raf = requestAnimationFrame(() => {
      if (!place()) applyCenteredPosition()
    })
    return () => cancelAnimationFrame(raf)
  }, [enabled, pos, panelRef, applyCenteredPosition])

  const resetPosition = useCallback(() => {
    clearStoredPanelPosition()
    applyCenteredPosition()
  }, [applyCenteredPosition])

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

  const panelStyle: CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }

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
