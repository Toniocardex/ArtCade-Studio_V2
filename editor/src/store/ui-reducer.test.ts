import { describe, it, expect } from 'vitest'
import { uiReducer } from './reducers/ui-reducer'
import { initialCoreState, type CoreState } from './editor-store-state'

function base(overrides: Partial<CoreState> = {}): CoreState {
  return { ...initialCoreState, ...overrides }
}

describe('uiReducer — bottom dock / console', () => {
  it('TOGGLE_CONSOLE opens Console tab when collapsed on Assets', () => {
    const s = uiReducer(base(), { type: 'TOGGLE_CONSOLE' })
    expect(s.bottomPanelTab).toBe('console')
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(true)
  })

  it('TOGGLE_CONSOLE collapses when Console is already expanded', () => {
    const start = base({
      bottomPanelTab: 'console',
      bottomPanelCollapsed: false,
      consoleOpen: true,
    })
    const s = uiReducer(start, { type: 'TOGGLE_CONSOLE' })
    expect(s.bottomPanelCollapsed).toBe(true)
    expect(s.consoleOpen).toBe(false)
  })

  it('SET_BOTTOM_PANEL_TAB switches tab and expands', () => {
    const start = base({ bottomPanelTab: 'assets', bottomPanelCollapsed: true })
    const s = uiReducer(start, { type: 'SET_BOTTOM_PANEL_TAB', tab: 'console' })
    expect(s.bottomPanelTab).toBe('console')
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(true)
  })

  it('SET_CONSOLE_OPEN(false) in canvas mode returns to Assets tab', () => {
    const start = base({
      bottomPanelTab: 'console',
      bottomPanelCollapsed: false,
      consoleOpen: true,
    })
    const s = uiReducer(start, { type: 'SET_CONSOLE_OPEN', open: false })
    expect(s.bottomPanelTab).toBe('assets')
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(false)
  })

  it('SET_CONSOLE_OPEN(false) in logic mode collapses the dock', () => {
    const start = base({
      mode: 'logic',
      bottomPanelTab: 'console',
      bottomPanelCollapsed: false,
      consoleOpen: true,
    })
    const s = uiReducer(start, { type: 'SET_CONSOLE_OPEN', open: false })
    expect(s.bottomPanelTab).toBe('console')
    expect(s.bottomPanelCollapsed).toBe(true)
    expect(s.consoleOpen).toBe(false)
  })

  it('SET_MODE away from canvas forces Console tab when on Assets', () => {
    const start = base({ mode: 'canvas', bottomPanelTab: 'assets' })
    const s = uiReducer(start, { type: 'SET_MODE', mode: 'logic' })
    expect(s.bottomPanelTab).toBe('console')
  })

  it('ACKNOWLEDGE_CONSOLE_LOGS only moves the watermark forward', () => {
    const start = base({ consoleAckUpToId: 10 })
    expect(uiReducer(start, { type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: 5 }).consoleAckUpToId).toBe(10)
    expect(uiReducer(start, { type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: 42 }).consoleAckUpToId).toBe(42)
  })
})
