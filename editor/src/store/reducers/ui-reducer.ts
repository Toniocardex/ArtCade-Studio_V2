// ---------------------------------------------------------------------------
// reducers/ui-reducer — editor UI state that does NOT live in ProjectDoc
// ---------------------------------------------------------------------------
//
// Selection, active view/tab, play mode, the snap-to-grid toggle and the
// tile brush index are all pure editor state. None of them mark the project
// dirty.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import {
  DEFAULT_EDITOR_GRID_SIZE, EDITOR_GRID_SIZE_MAX, EDITOR_GRID_SIZE_MIN,
  DEFAULT_EDITOR_RULER_STEP, EDITOR_RULER_STEP_MAX, EDITOR_RULER_STEP_MIN,
} from '../../constants/editor-viewport'
import type { DockPanelId } from '../../constants/dock-panels'
import { clampEditorZoom } from '../../utils/editor-zoom'
import {
  applyAuthoringModeToDocument,
  persistAuthoringMode,
} from '../../utils/authoring-mode'
import { persistDockPanelVisibility } from '../../utils/dock-panel-visibility'
import {
  expandDockWithConsole,
  mergeDockUiSlice,
  revealConsoleOnLog,
  setDockPanelVisible,
  toggleConsoleDock,
  withDerivedConsoleOpen,
  type DockUiSlice,
} from '../../utils/dock-ui-state'
import { writeEditorPreferences } from '../../utils/editor-preferences'
import { resolveScriptEditorActivationPath } from '../../utils/script-editor-activation'

const MAX_RECENT_PAINT_TILESETS = 8

function beginTilesetPaint(state: CoreState, tilesetId: string): CoreState {
  const recent = [
    tilesetId,
    ...state.recentPaintTilesetIds.filter((id) => id !== tilesetId),
  ].slice(0, MAX_RECENT_PAINT_TILESETS)
  return {
    ...state,
    activePaintTilesetId: tilesetId,
    tilePaletteOpen: true,
    selectedTileCell: 1,
    recentPaintTilesetIds: recent,
  }
}

function endTilesetPaint(state: CoreState): CoreState {
  return state.activePaintTilesetId === null && !state.tilePaletteOpen
    ? state
    : { ...state, activePaintTilesetId: null, tilePaletteOpen: false }
}

function applyDockUiChange(state: CoreState, slice: DockUiSlice): CoreState {
  if (slice.dockPanelVisibility !== state.dockPanelVisibility) {
    persistDockPanelVisibility(slice.dockPanelVisibility)
  }
  return mergeDockUiSlice(state, slice)
}

function setDockPanelVisibleOnState(
  state: CoreState,
  panel: DockPanelId,
  visible: boolean,
): CoreState {
  const next = setDockPanelVisible(state, panel, visible)
  if (!next) return state
  return applyDockUiChange(state, next)
}

export const uiReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'SELECT_ENTITY': {
      if (action.entityId == null) {
        return {
          ...state,
          selection: { ...state.selection, entityId: null, entityIds: [] },
          inspectorAsset: null,
          inspectorLayerId: null,
        }
      }
      if (action.additive) {
        const current = state.selection.entityIds ?? (
          state.selection.entityId != null ? [state.selection.entityId] : []
        )
        const alreadySelected = current.includes(action.entityId)
        const entityIds = alreadySelected
          ? current.filter((id) => id !== action.entityId)
          : [...current, action.entityId]
        return {
          ...state,
          selection: {
            ...state.selection,
            entityId: alreadySelected
              ? (entityIds.length > 0 ? entityIds[entityIds.length - 1] : null)
              : action.entityId,
            entityIds,
          },
          inspectorAsset: null,
          inspectorLayerId: null,
        }
      }
      return {
        ...state,
        selection: { ...state.selection, entityId: action.entityId, entityIds: [action.entityId] },
        inspectorAsset: null,
        inspectorLayerId: null,
      }
    }
    case 'SELECT_SCENE':
      return {
        ...state,
        selection: { ...state.selection, sceneId: action.sceneId, entityId: null, entityIds: [] },
        inspectorAsset: null,
        inspectorLayerId: null,
      }
    case 'SELECT_INSPECTOR_ASSET':
      return {
        ...state,
        inspectorAsset: action.asset,
        inspectorLayerId: null,
        selection: { ...state.selection, entityId: null, entityIds: [] },
      }
    case 'SELECT_INSPECTOR_LAYER': {
      const layerId = action.layerId
      const lastMap = state.activePaintTilesetId
        ? { ...state.lastPaintTilesetByLayer, [state.editorActiveLayerId]: state.activePaintTilesetId }
        : state.lastPaintTilesetByLayer
      const restored = layerId ? lastMap[layerId] : undefined
      return {
        ...state,
        inspectorLayerId: layerId,
        editorActiveLayerId: layerId ?? state.editorActiveLayerId,
        inspectorAsset: null,
        selection: { ...state.selection, entityId: null, entityIds: [] },
        lastPaintTilesetByLayer: lastMap,
        ...(restored && state.tilePaletteOpen ? { activePaintTilesetId: restored } : {}),
      }
    }
    case 'SET_EDITOR_ACTIVE_LAYER':
      if (state.editorActiveLayerId === action.layerId) return state
      {
        const lastMap = state.activePaintTilesetId
          ? { ...state.lastPaintTilesetByLayer, [state.editorActiveLayerId]: state.activePaintTilesetId }
          : state.lastPaintTilesetByLayer
        const restored = lastMap[action.layerId]
        return {
          ...state,
          editorActiveLayerId: action.layerId,
          inspectorLayerId: action.layerId,
          lastPaintTilesetByLayer: lastMap,
          ...(restored && state.tilePaletteOpen ? { activePaintTilesetId: restored } : {}),
        }
      }
    case 'SET_MODE': {
      // Explicit workspace change during Play cancels origin restore on Stop.
      const clearOrigin = state.isPlaying ? { modeBeforePlay: null as const } : {}
      if (action.mode !== 'script') {
        return { ...state, mode: action.mode, ...clearOrigin }
      }
      const activeScriptPath = resolveScriptEditorActivationPath(state, { preferSelection: true })
      return {
        ...state,
        mode: action.mode,
        mainScriptView: 'manual',
        ...clearOrigin,
        ...(activeScriptPath && activeScriptPath !== state.activeScriptPath
          ? { activeScriptPath }
          : {}),
      }
    }
    case 'TOGGLE_FOCUS_MODE': {
      const next = !state.focusMode
      return {
        ...state,
        focusMode: next,
        mode: next ? 'canvas' : state.mode,
        activePaintTilesetId: next ? null : state.activePaintTilesetId,
        tilePaletteOpen: next ? false : state.tilePaletteOpen,
      }
    }
    case 'SET_FOCUS_MODE':
      if (state.focusMode === action.enabled) return state
      return {
        ...state,
        focusMode: action.enabled,
        mode: action.enabled ? 'canvas' : state.mode,
        activePaintTilesetId: action.enabled ? null : state.activePaintTilesetId,
        tilePaletteOpen: action.enabled ? false : state.tilePaletteOpen,
      }
    case 'SET_REDUCE_MOTION':
      if (state.reduceMotion === action.enabled) return state
      writeEditorPreferences({ reduceMotion: action.enabled })
      return { ...state, reduceMotion: action.enabled }
    case 'SET_AUTHORING_MODE': {
      if (state.authoringMode === action.mode) return state
      persistAuthoringMode(action.mode)
      applyAuthoringModeToDocument(action.mode)
      return { ...state, authoringMode: action.mode }
    }
    case 'TOGGLE_CONSOLE': {
      const next = toggleConsoleDock(state)
      if (!state.dockPanelVisibility.console && next.dockPanelVisibility.console) {
        persistDockPanelVisibility(next.dockPanelVisibility)
      }
      return mergeDockUiSlice(state, next)
    }
    case 'SET_CONSOLE_OPEN':
      if (action.open) {
        const next = expandDockWithConsole(state)
        if (!state.dockPanelVisibility.console) {
          persistDockPanelVisibility(next.dockPanelVisibility)
        }
        return mergeDockUiSlice(state, next)
      }
      return mergeDockUiSlice(
        state,
        withDerivedConsoleOpen({ ...state, bottomPanelCollapsed: true }),
      )
    case 'SET_BOTTOM_PANEL_COLLAPSED':
      return state.bottomPanelCollapsed === action.collapsed
        ? state
        : mergeDockUiSlice(
            state,
            withDerivedConsoleOpen({ ...state, bottomPanelCollapsed: action.collapsed }),
          )
    case 'SET_DOCK_PANEL_VISIBLE':
      return setDockPanelVisibleOnState(state, action.panel, action.visible)
    case 'TOGGLE_DOCK_PANEL':
      return setDockPanelVisibleOnState(
        state,
        action.panel,
        !state.dockPanelVisibility[action.panel],
      )
    case 'LOG': {
      if (action.entry.level !== 'warn' && action.entry.level !== 'error') {
        return state
      }
      const next = revealConsoleOnLog(state)
      if (!next) return state
      if (!state.dockPanelVisibility.console) {
        persistDockPanelVisibility(next.dockPanelVisibility)
      }
      return mergeDockUiSlice(state, next)
    }
    case 'ACKNOWLEDGE_CONSOLE_LOGS':
      return action.upToId <= state.consoleAckUpToId
        ? state
        : { ...state, consoleAckUpToId: action.upToId }
    case 'TILESET_PAINT_BEGIN':
    case 'TILESET_EDIT_OPEN':
      return beginTilesetPaint(state, action.tilesetId)
    case 'TILESET_PAINT_END':
    case 'TILESET_EDIT_CLOSE':
      return endTilesetPaint(state)
    case 'TILESET_TOGGLE_PALETTE':
      return state.activePaintTilesetId === null
        ? state
        : { ...state, tilePaletteOpen: !state.tilePaletteOpen }
    case 'DISMISS_PAINT_SOURCE_NOTICE':
      return state.paintSourceNotice === null
        ? state
        : { ...state, paintSourceNotice: null }
    case 'SET_PLAYING': {
      if (action.playing === state.isPlaying) return state
      if (action.playing) {
        // Capture origin workspace, then enter Scene for gameplay (paletto §13).
        return {
          ...state,
          isPlaying: true,
          modeBeforePlay: state.mode,
          mode: 'canvas',
        }
      }
      return {
        ...state,
        isPlaying: false,
        mode: state.modeBeforePlay ?? state.mode,
        modeBeforePlay: null,
      }
    }
    case 'EDITOR_SET_GRID_SIZE': {
      const rounded = Math.round(action.tileSize)
      const tileSize = Number.isFinite(rounded)
        ? Math.min(EDITOR_GRID_SIZE_MAX, Math.max(EDITOR_GRID_SIZE_MIN, rounded))
        : DEFAULT_EDITOR_GRID_SIZE
      return state.editorGridSize === tileSize ? state : { ...state, editorGridSize: tileSize }
    }
    case 'EDITOR_SET_RULER_STEP': {
      const rounded = Math.round(action.step)
      const step = Number.isFinite(rounded)
        ? Math.min(EDITOR_RULER_STEP_MAX, Math.max(EDITOR_RULER_STEP_MIN, rounded))
        : DEFAULT_EDITOR_RULER_STEP
      return state.editorRulerStep === step ? state : { ...state, editorRulerStep: step }
    }
    case 'SET_RULERS_VISIBLE':
      return state.editorRulersVisible === action.visible
        ? state
        : { ...state, editorRulersVisible: action.visible }
    case 'SET_SNAP_TO_GRID':
      return state.snapToGrid === action.enabled
        ? state
        : { ...state, snapToGrid: action.enabled }
    case 'TOGGLE_EDITOR_GUIDES':
      return { ...state, editorGuidesVisible: !state.editorGuidesVisible }
    case 'EDITOR_SET_ZOOM': {
      const next = clampEditorZoom(action.zoom)
      if (state.editorZoom === next && state.editorZoomMode === 'manual') return state
      return { ...state, editorZoom: next, editorZoomMode: 'manual' }
    }
    case 'EDITOR_SET_FIT_ZOOM': {
      const next = clampEditorZoom(action.zoom)
      if (state.editorZoom === next && state.editorZoomMode === 'fit') return state
      return { ...state, editorZoom: next, editorZoomMode: 'fit' }
    }
    case 'EDITOR_SET_CAMERA_PREVIEW':
      return state.cameraPreview === action.enabled
        ? state
        : { ...state, cameraPreview: action.enabled }
    case 'TILESET_SELECT_CELL':
      return { ...state, selectedTileCell: Math.max(0, action.cellIndex) }
    case 'SPRITESHEET_STUDIO_OPEN':
      return {
        ...state,
        spritesheetStudio: {
          open: true,
          imageAssetId: action.imageAssetId,
          ...(action.initialMode ? { initialMode: action.initialMode } : {}),
        },
      }
    case 'SPRITESHEET_STUDIO_CLOSE':
      return state.spritesheetStudio.open
        ? { ...state, spritesheetStudio: { open: false, imageAssetId: null } }
        : state
    default:
      return state
  }
}
