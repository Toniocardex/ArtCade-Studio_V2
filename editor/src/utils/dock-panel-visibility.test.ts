import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  readStoredDockPanelVisibility,
  persistDockPanelVisibility,
} from './dock-panel-visibility'
import {
  DEFAULT_DOCK_PANEL_VISIBILITY,
  DOCK_VISIBILITY_STORAGE_KEY,
} from '../constants/dock-panels'

describe('dock-panel-visibility storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('readStoredDockPanelVisibility falls back to defaults when missing', () => {
    expect(readStoredDockPanelVisibility()).toEqual(DEFAULT_DOCK_PANEL_VISIBILITY)
  })

  it('readStoredDockPanelVisibility normalizes all-false JSON', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ console: false, timeline: false, events: false }),
    )
    expect(readStoredDockPanelVisibility()).toEqual(DEFAULT_DOCK_PANEL_VISIBILITY)
  })

  it('readStoredDockPanelVisibility keeps partial valid stored state', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ console: false, timeline: true }),
    )
    expect(readStoredDockPanelVisibility()).toEqual({
      console: false,
      timeline: true,
      events: false,
    })
  })

  it('persistDockPanelVisibility writes normalized visibility', () => {
    persistDockPanelVisibility({
      console: false,
      timeline: false,
      events: false,
    })
    expect(localStorage.setItem).toHaveBeenCalledWith(
      DOCK_VISIBILITY_STORAGE_KEY,
      JSON.stringify(DEFAULT_DOCK_PANEL_VISIBILITY),
    )
  })

  it('ignores unknown keys in stored JSON', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ console: true, extraPanel: true, logic: true }),
    )
    expect(readStoredDockPanelVisibility().console).toBe(true)
    expect(readStoredDockPanelVisibility().timeline).toBe(
      DEFAULT_DOCK_PANEL_VISIBILITY.timeline,
    )
  })
})
