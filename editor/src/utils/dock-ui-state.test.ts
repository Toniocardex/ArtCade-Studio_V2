import { describe, it, expect } from 'vitest'
import {
  createInitialDockUiSlice,
  deriveConsoleOpen,
  normalizeDockPanelVisibility,
  toggleConsoleDock,
  withDerivedConsoleOpen,
} from './dock-ui-state'
import { DEFAULT_DOCK_PANEL_VISIBILITY } from '../constants/dock-panels'

describe('normalizeDockPanelVisibility', () => {
  it('returns defaults when no panel is visible', () => {
    const allOff = { console: false, timeline: false, events: false }
    expect(normalizeDockPanelVisibility(allOff)).toEqual(DEFAULT_DOCK_PANEL_VISIBILITY)
  })

  it('preserves visibility when at least one panel is on', () => {
    const vis = { console: false, timeline: true, events: false }
    expect(normalizeDockPanelVisibility(vis)).toEqual(vis)
  })
})

describe('deriveConsoleOpen', () => {
  it('is false when dock collapsed', () => {
    expect(deriveConsoleOpen(true, DEFAULT_DOCK_PANEL_VISIBILITY)).toBe(false)
  })

  it('is false when console panel hidden', () => {
    expect(
      deriveConsoleOpen(false, { ...DEFAULT_DOCK_PANEL_VISIBILITY, console: false }),
    ).toBe(false)
  })

  it('is true when dock expanded and console visible', () => {
    expect(deriveConsoleOpen(false, DEFAULT_DOCK_PANEL_VISIBILITY)).toBe(true)
  })
})

describe('createInitialDockUiSlice', () => {
  it('derives consoleOpen from visibility at boot', () => {
    const slice = createInitialDockUiSlice({
      console: false,
      timeline: true,
      events: false,
    })
    expect(slice.bottomPanelCollapsed).toBe(false)
    expect(slice.consoleOpen).toBe(false)
    expect(slice.dockPanelVisibility.timeline).toBe(true)
  })

  it('normalizes all-off storage to defaults with console open', () => {
    const slice = createInitialDockUiSlice({
      console: false,
      timeline: false,
      events: false,
    })
    expect(slice.dockPanelVisibility).toEqual(DEFAULT_DOCK_PANEL_VISIBILITY)
    expect(slice.consoleOpen).toBe(true)
  })
})

describe('toggleConsoleDock', () => {
  it('matches withDerivedConsoleOpen after hide-console path', () => {
    const start = withDerivedConsoleOpen({
      bottomPanelCollapsed: false,
      dockPanelVisibility: { ...DEFAULT_DOCK_PANEL_VISIBILITY, timeline: true },
      consoleOpen: true,
    })
    const next = toggleConsoleDock(start)
    expect(next.dockPanelVisibility.console).toBe(false)
    expect(next.consoleOpen).toBe(false)
  })
})
