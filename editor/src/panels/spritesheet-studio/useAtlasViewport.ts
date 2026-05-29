import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  clampSpriteStudioZoom,
  computeSpriteStudioFitZoom,
  nextSpriteStudioZoomStep,
  SPRITE_STUDIO_ZOOM_DEFAULT,
} from './atlas-viewport'

export type AtlasViewportState = Readonly<{
  scrollRef: RefObject<HTMLDivElement | null>
  zoom: number
  zoomMode: 'fit' | 'manual'
  zoomFit: () => void
  zoom100: () => void
  zoomIn: () => void
  zoomOut: () => void
  setZoomManual: (z: number) => void
  displayW: number
  displayH: number
}>

export function useAtlasViewport(imgWH: { w: number; h: number } | null): AtlasViewportState {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit')
  const [manualZoom, setManualZoom] = useState(SPRITE_STUDIO_ZOOM_DEFAULT)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (cr) setContainerSize({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [imgWH])

  const fitZoom = useMemo(() => {
    if (!imgWH || containerSize.w <= 0 || containerSize.h <= 0) return SPRITE_STUDIO_ZOOM_DEFAULT
    return computeSpriteStudioFitZoom(containerSize.w, containerSize.h, imgWH.w, imgWH.h)
  }, [imgWH, containerSize.w, containerSize.h])

  const zoom = zoomMode === 'fit' ? fitZoom : manualZoom
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const zoomFit = useCallback(() => setZoomMode('fit'), [])
  const zoom100 = useCallback(() => {
    setZoomMode('manual')
    setManualZoom(SPRITE_STUDIO_ZOOM_DEFAULT)
  }, [])
  const zoomIn = useCallback(() => {
    setZoomMode('manual')
    setManualZoom(nextSpriteStudioZoomStep(zoomRef.current, 1))
  }, [])
  const zoomOut = useCallback(() => {
    setZoomMode('manual')
    setManualZoom(nextSpriteStudioZoomStep(zoomRef.current, -1))
  }, [])
  const setZoomManual = useCallback((z: number) => {
    setZoomMode('manual')
    setManualZoom(clampSpriteStudioZoom(z))
  }, [])

  useEffect(() => {
    setZoomMode('fit')
  }, [imgWH?.w, imgWH?.h])

  const displayW = imgWH ? Math.round(imgWH.w * zoom) : 0
  const displayH = imgWH ? Math.round(imgWH.h * zoom) : 0

  return {
    scrollRef,
    zoom,
    zoomMode,
    zoomFit,
    zoom100,
    zoomIn,
    zoomOut,
    setZoomManual,
    displayW,
    displayH,
  }
}
