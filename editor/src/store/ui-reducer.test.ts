import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uiReducer } from './reducers/ui-reducer'
import { initialCoreState, type CoreState } from './editor-store-state'
import type { ConsoleEntry } from '../types'
import {
  DEFAULT_DOCK_PANEL_VISIBILITY,
  DOCK_VISIBILITY_STORAGE_KEY,
} from '../constants/dock-panels'
import { deriveConsoleOpen } from '../utils/dock-ui-state'

function base(overrides: Partial<CoreState> = {}): CoreState {
  return { ...initialCoreState, ...overrides }
}

function logEntry(level: ConsoleEntry['level'], id: number): ConsoleEntry {
  return { id, time: '12:00:00', message: 'test', level }
}

describe('initialCoreState — dock boot sync', () => {
  it('consoleOpen matches deriveConsoleOpen from dock fields', () => {
    expect(initialCoreState.consoleOpen).toBe(
      deriveConsoleOpen(
        initialCoreState.bottomPanelCollapsed,
        initialCoreState.dockPanelVisibility,
      ),
    )
  })
})

describe('uiReducer — inspector context', () => {
  it('SELECT_INSPECTOR_ASSET clears entity and layer', () => {
    const start = base({
      selection: { entityId: 3, entityIds: [3], sceneId: 's1' },
      inspectorLayerName: 'UI',
    })
    const s = uiReducer(start, {
      type: 'SELECT_INSPECTOR_ASSET',
      asset: { type: 'image', id: 'img_1' },
    })
    expect(s.inspectorAsset).toEqual({ type: 'image', id: 'img_1' })
    expect(s.selection.entityId).toBeNull()
    expect(s.selection.entityIds).toEqual([])
    expect(s.inspectorLayerName).toBeNull()
  })

  it('SELECT_ENTITY replaces or toggles the same-scene multi-selection set', () => {
    let s = uiReducer(base(), { type: 'SELECT_ENTITY', entityId: 1 })
    expect(s.selection).toMatchObject({ entityId: 1, entityIds: [1] })

    s = uiReducer(s, { type: 'SELECT_ENTITY', entityId: 2, additive: true })
    expect(s.selection).toMatchObject({ entityId: 2, entityIds: [1, 2] })

    s = uiReducer(s, { type: 'SELECT_ENTITY', entityId: 1, additive: true })
    expect(s.selection).toMatchObject({ entityId: 2, entityIds: [2] })

    s = uiReducer(s, { type: 'SELECT_ENTITY', entityId: 1 })
    expect(s.selection).toMatchObject({ entityId: 1, entityIds: [1] })

    s = uiReducer(s, { type: 'SELECT_ENTITY', entityId: null })
    expect(s.selection).toMatchObject({ entityId: null, entityIds: [] })
  })
})

describe('uiReducer — console dock', () => {
  it('TOGGLE_CONSOLE expands when collapsed', () => {
    const s = uiReducer(base({ bottomPanelCollapsed: true }), { type: 'TOGGLE_CONSOLE' })
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(true)
  })

  it('TOGGLE_CONSOLE hides console when other dock panels are visible', () => {
    const start = base({
      bottomPanelCollapsed: false,
      consoleOpen: true,
      dockPanelVisibility: { console: true, timeline: true, events: false },
    })
    const s = uiReducer(start, { type: 'TOGGLE_CONSOLE' })
    expect(s.dockPanelVisibility.console).toBe(false)
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(false)
  })

  it('TOGGLE_CONSOLE collapses dock when console is the only visible panel', () => {
    const start = base({
      bottomPanelCollapsed: false,
      consoleOpen: true,
      dockPanelVisibility: { console: true, timeline: false, events: false },
    })
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
    const s = uiReducer(
      base({ bottomPanelCollapsed: true, consoleOpen: false }),
      { type: 'LOG', entry: logEntry('info', 1) },
    )
    expect(s.bottomPanelCollapsed).toBe(true)
    expect(s.consoleOpen).toBe(false)
  })

  it('ACKNOWLEDGE_CONSOLE_LOGS only moves the watermark forward', () => {
    const start = base({ consoleAckUpToId: 10 })
    expect(uiReducer(start, { type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: 5 }).consoleAckUpToId).toBe(10)
    expect(uiReducer(start, { type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: 42 }).consoleAckUpToId).toBe(42)
  })

  it('consoleOpen is false when dock expanded but console panel hidden', () => {
    const start = base({
      bottomPanelCollapsed: false,
      consoleOpen: false,
      dockPanelVisibility: { ...DEFAULT_DOCK_PANEL_VISIBILITY, console: false },
    })
    expect(start.consoleOpen).toBe(false)
    const s = uiReducer(start, { type: 'SET_BOTTOM_PANEL_COLLAPSED', collapsed: false })
    expect(s.consoleOpen).toBe(false)
  })

  it('TOGGLE_CONSOLE enables console panel when expanding dock', () => {
    const start = base({
      bottomPanelCollapsed: true,
      dockPanelVisibility: { ...DEFAULT_DOCK_PANEL_VISIBILITY, console: false },
    })
    const s = uiReducer(start, { type: 'TOGGLE_CONSOLE' })
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.dockPanelVisibility.console).toBe(true)
    expect(s.consoleOpen).toBe(true)
  })

  it('LOG error reveals console when panel was hidden', () => {
    const start = base({
      bottomPanelCollapsed: false,
      dockPanelVisibility: { ...DEFAULT_DOCK_PANEL_VISIBILITY, console: false },
      consoleOpen: false,
    })
    const s = uiReducer(start, { type: 'LOG', entry: logEntry('error', 2) })
    expect(s.dockPanelVisibility.console).toBe(true)
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(s.consoleOpen).toBe(true)
  })
})

describe('uiReducer — dock panel visibility', () => {
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

  it('SET_DOCK_PANEL_VISIBLE persists and expands collapsed dock', () => {
    const start = base({
      bottomPanelCollapsed: true,
      dockPanelVisibility: { console: false, timeline: false, events: true },
    })
    const s = uiReducer(start, {
      type: 'SET_DOCK_PANEL_VISIBLE',
      panel: 'timeline',
      visible: true,
    })
    expect(s.dockPanelVisibility.timeline).toBe(true)
    expect(s.bottomPanelCollapsed).toBe(false)
    expect(localStorage.setItem).toHaveBeenCalledWith(
      DOCK_VISIBILITY_STORAGE_KEY,
      expect.any(String),
    )
  })

  it('cannot hide the last visible panel', () => {
    const vis = { console: true, timeline: false, events: false }
    const start = base({ dockPanelVisibility: vis })
    const s = uiReducer(start, {
      type: 'SET_DOCK_PANEL_VISIBLE',
      panel: 'console',
      visible: false,
    })
    expect(s).toBe(start)
  })

  it('TOGGLE_DOCK_PANEL flips panel visibility', () => {
    const start = base()
    const s = uiReducer(start, { type: 'TOGGLE_DOCK_PANEL', panel: 'events' })
    expect(s.dockPanelVisibility.events).toBe(true)
  })
})

describe('uiReducer — script editor mode', () => {
  const scriptProject = {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'Hero',
        className: 'Player',
        tags: [] as string[],
        scriptPath: 'scripts/hero.lua',
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: {
          spriteAssetId: '',
          tint: { x: 1, y: 1, z: 1, w: 1 },
          fillColor: { x: 1, y: 1, z: 1 },
          alpha: 1,
          pivot: { x: 0.5, y: 0.5 },
          renderOrder: 0,
        },
      },
    },
    scenes: {},
  }

  it('SET_MODE script activates main.lua when it is already open', () => {
    const start = base({
      mode: 'canvas',
      project: { ...scriptProject, entities: {} },
      openScripts: [{ path: 'scripts/main.lua', content: '-- main', isDirty: false }],
      activeScriptPath: null,
    })
    const s = uiReducer(start, { type: 'SET_MODE', mode: 'script' })
    expect(s.mode).toBe('script')
    expect(s.mainScriptView).toBe('manual')
    expect(s.activeScriptPath).toBe('scripts/main.lua')
  })

  it('SET_MODE script prefers the selected entity script over main.lua', () => {
    const start = base({
      mode: 'canvas',
      project: scriptProject,
      selection: { entityId: 1, sceneId: 's' },
      openScripts: [
        { path: 'scripts/main.lua', content: '-- main', isDirty: false },
        { path: 'scripts/hero.lua', content: '-- hero', isDirty: false },
      ],
      activeScriptPath: 'scripts/main.lua',
    })
    const s = uiReducer(start, { type: 'SET_MODE', mode: 'script' })
    expect(s.activeScriptPath).toBe('scripts/hero.lua')
  })

  it('SET_MODE logic does not change activeScriptPath', () => {
    const start = base({
      mode: 'script',
      activeScriptPath: 'scripts/main.lua',
      openScripts: [{ path: 'scripts/main.lua', content: '-- main', isDirty: false }],
    })
    const s = uiReducer(start, { type: 'SET_MODE', mode: 'logic' })
    expect(s.mode).toBe('logic')
    expect(s.activeScriptPath).toBe('scripts/main.lua')
  })
})

describe('uiReducer — focus mode & preferences', () => {
  it('TOGGLE_FOCUS_MODE switches focus and forces canvas mode', () => {
    const start = base({ mode: 'logic', focusMode: false })
    const on = uiReducer(start, { type: 'TOGGLE_FOCUS_MODE' })
    expect(on.focusMode).toBe(true)
    expect(on.mode).toBe('canvas')
    const off = uiReducer(on, { type: 'TOGGLE_FOCUS_MODE' })
    expect(off.focusMode).toBe(false)
    expect(off.mode).toBe('canvas')
  })

  it('SET_FOCUS_MODE clears tileset edit when enabling focus', () => {
    const start = base({
      activePaintTilesetId: 'ts_1',
      tilePaletteOpen: true,
      focusMode: false,
    })
    const s = uiReducer(start, { type: 'SET_FOCUS_MODE', enabled: true })
    expect(s.focusMode).toBe(true)
    expect(s.activePaintTilesetId).toBeNull()
    expect(s.tilePaletteOpen).toBe(false)
  })

  it('SET_REDUCE_MOTION persists preference', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    const s = uiReducer(base(), { type: 'SET_REDUCE_MOTION', enabled: true })
    expect(s.reduceMotion).toBe(true)
    expect(localStorage.setItem).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('uiReducer — spritesheet studio', () => {
  it('SPRITESHEET_STUDIO_OPEN sets open and imageAssetId', () => {
    const s = uiReducer(base(), {
      type: 'SPRITESHEET_STUDIO_OPEN',
      imageAssetId: 'img_hero',
    })
    expect(s.spritesheetStudio).toEqual({ open: true, imageAssetId: 'img_hero' })
  })

  it('SPRITESHEET_STUDIO_CLOSE clears modal state', () => {
    const start = base({
      spritesheetStudio: { open: true, imageAssetId: 'img_hero' },
    })
    const s = uiReducer(start, { type: 'SPRITESHEET_STUDIO_CLOSE' })
    expect(s.spritesheetStudio).toEqual({ open: false, imageAssetId: null })
  })
})
