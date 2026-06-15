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
    case 'SELECT_ENTITY':
      return {
        ...state,
        selection: { ...state.selection, entityId: action.entityId },
        inspectorAsset: null,
        inspectorLayerName: null,
      }
    case 'SELECT_SCENE':
      return {
        ...state,
        selection: { ...state.selection, sceneId: action.sceneId, entityId: null },
        inspectorAsset: null,
        inspectorLayerName: null,
      }
    case 'SELECT_INSPECTOR_ASSET':
      return {
        ...state,
        inspectorAsset: action.asset,
        inspectorLayerName: null,
        selection: { ...state.selection, entityId: null },
      }
    case 'SELECT_INSPECTOR_LAYER':
      return {
        ...state,
        inspectorLayerName: action.layerName,
        editorActiveLayer: action.layerName ?? state.editorActiveLayer,
        inspectorAsset: null,
        selection: { ...state.selection, entityId: null },
      }
    case 'SET_EDITOR_ACTIVE_LAYER':
      return state.editorActiveLayer === action.layerName
        ? state
        : {
            ...state,
            editorActiveLayer: action.layerName,
            inspectorLayerName: action.layerName,
          }
    case 'ENTITY_SET_DISPLAY_LAYER':
      return {
        ...state,
        entityDisplayLayers: {
          ...state.entityDisplayLayers,
          [action.entityId]: action.layerName,
        },
        editorActiveLayer: action.layerName,
        inspectorLayerName: action.layerName,
      }
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        ...(action.mode === 'script' ? { mainScriptView: 'manual' as const } : {}),
      }
    case 'TOGGLE_FOCUS_MODE': {
      const next = !state.focusMode
      return {
        ...state,
        focusMode: next,
        mode: next ? 'canvas' : state.mode,
        editingTilesetId: next ? null : state.editingTilesetId,
      }
    }
    case 'SET_FOCUS_MODE':
      if (state.focusMode === action.enabled) return state
      return {
        ...state,
        focusMode: action.enabled,
        mode: action.enabled ? 'canvas' : state.mode,
        editingTilesetId: action.enabled ? null : state.editingTilesetId,
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
    case 'TILESET_EDIT_OPEN':
      return { ...state, editingTilesetId: action.tilesetId }
    case 'TILESET_EDIT_CLOSE':
      return state.editingTilesetId === null
        ? state
        : { ...state, editingTilesetId: null }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing }
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
        spritesheetStudio: { open: true, imageAssetId: action.imageAssetId },
      }
    case 'SPRITESHEET_STUDIO_CLOSE':
      return state.spritesheetStudio.open
        ? { ...state, spritesheetStudio: { open: false, imageAssetId: null } }
        : state
    default:
      return state
  }
}
