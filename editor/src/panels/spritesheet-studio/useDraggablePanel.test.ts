/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  centerPanelPosition,
  clearStoredPanelPosition,
  defaultPanelSize,
  measurePanelSize,
} from './useDraggablePanel'

describe('centerPanelPosition', () => {
  const innerW = 1200
  const innerH = 800

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerW })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerH })
  })

  afterEach(() => {
    clearStoredPanelPosition()
  })

  it('places panel top-left so the panel box is viewport-centered', () => {
    const panelW = 400
    const panelH = 600
    const pos = centerPanelPosition(panelW, panelH)
    expect(pos.x).toBe((innerW - panelW) / 2)
    expect(pos.y).toBe((innerH - panelH) / 2)
  })

  it('measurePanelSize uses fallback when layout reports zero', () => {
    const el = document.createElement('div')
    el.style.width = 'min(96vw, 1400px)'
    el.style.height = 'min(90vh, 820px)'
    document.body.append(el)
    Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 0 })
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 0 })
    el.getBoundingClientRect = () =>
      ({
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const { w, h } = measurePanelSize(el)
    const fallback = defaultPanelSize()
    expect(w).toBe(fallback.w)
    expect(h).toBe(fallback.h)
    el.remove()
  })
})
