/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { centerPanelPosition, clearStoredPanelPosition } from './useDraggablePanel'

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

  it('places panel center on viewport center', () => {
    const panelW = 400
    const panelH = 600
    const pos = centerPanelPosition(panelW, panelH)
    expect(pos.x).toBe((innerW - panelW) / 2)
    expect(pos.y).toBe((innerH - panelH) / 2)
  })
})
