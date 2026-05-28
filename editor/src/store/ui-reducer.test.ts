import { describe, it, expect } from 'vitest'
import { uiReducer } from './reducers/ui-reducer'
import { initialCoreState, type CoreState } from './editor-store-state'
import type { ConsoleEntry } from '../types'

function base(overrides: Partial<CoreState> = {}): CoreState {
  return { ...initialCoreState, ...overrides }
}

function logEntry(level: ConsoleEntry['level'], id: number): ConsoleEntry {
  return { id, time: '12:00:00', message: 'test', level }
}

describe('uiReducer — console dock', () => {
  it('TOGGLE_CONSOLE expands when collapsed', () => {
    const s = uiReducer(base({ bottomPanelCollapsed: true }), { type: 'TOGGLE_CONSOLE' })
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(true)
  })

  it('TOGGLE_CONSOLE collapses when expanded', () => {
    const start = base({ bottomPanelCollapsed: false, consoleOpen: true })
    const s = uiReducer(start, { type: 'TOGGLE_CONSOLE' })
    expect(s.bottomPanelCollapsed).toBe(true)
    expect(s.consoleOpen).toBe(false)
  })

  it('SET_CONSOLE_OPEN(true) expands the dock', () => {
    const s = uiReducer(base({ bottomPanelCollapsed: true }), {
      type: 'SET_CONSOLE_OPEN',
      open: true,
    })
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(true)
  })

  it('SET_CONSOLE_OPEN(false) collapses the dock in canvas mode', () => {
    const start = base({ bottomPanelCollapsed: false, consoleOpen: true })
    const s = uiReducer(start, { type: 'SET_CONSOLE_OPEN', open: false })
    expect(s.bottomPanelCollapsed).toBe(true)
    expect(s.consoleOpen).toBe(false)
  })

  it('SET_CONSOLE_OPEN(false) collapses the dock in logic mode', () => {
    const start = base({
      mode: 'logic',
      bottomPanelCollapsed: false,
      consoleOpen: true,
    })
    const s = uiReducer(start, { type: 'SET_CONSOLE_OPEN', open: false })
    expect(s.bottomPanelCollapsed).toBe(true)
    expect(s.consoleOpen).toBe(false)
  })

  it('LOG warn/error auto-expands collapsed console', () => {
    const s = uiReducer(base({ bottomPanelCollapsed: true }), {
      type: 'LOG',
      entry: logEntry('error', 1),
    })
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(true)
  })

  it('LOG info does not expand collapsed console', () => {
    const s = uiReducer(base({ bottomPanelCollapsed: true }), {
      type: 'LOG',
      entry: logEntry('info', 1),
    })
    expect(s.bottomPanelCollapsed).toBe(true)
    expect(s.consoleOpen).toBe(false)
  })

  it('ACKNOWLEDGE_CONSOLE_LOGS only moves the watermark forward', () => {
    const start = base({ consoleAckUpToId: 10 })
    expect(uiReducer(start, { type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: 5 }).consoleAckUpToId).toBe(10)
    expect(uiReducer(start, { type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: 42 }).consoleAckUpToId).toBe(42)
  })
})
