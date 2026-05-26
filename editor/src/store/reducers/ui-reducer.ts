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
} from '../../constants/editor-viewport'
import { clampEditorZoom } from '../../utils/editor-zoom'
import {
  applyAuthoringModeToDocument,
  persistAuthoringMode,
} from '../../utils/authoring-mode'

function syncConsoleOpen(state: CoreState): CoreState {
  return {
    ...state,
    consoleOpen: !state.bottomPanelCollapsed && state.bottomPanelTab === 'console',
  }
}

export const uiReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'SELECT_ENTITY':
      return { ...state, selection: { ...state.selection, entityId: action.entityId } }
    case 'SELECT_SCENE':
      return {
        ...state,
        selection: { ...state.selection, sceneId: action.sceneId, entityId: null },
      }
    case 'SET_MODE': {
      const next = { ...state, mode: action.mode }
      if (action.mode !== 'canvas' && next.bottomPanelTab === 'assets') {
        return syncConsoleOpen({ ...next, bottomPanelTab: 'console' })
      }
      return next
    }
    case 'SET_AUTHORING_MODE': {
      if (state.authoringMode === action.mode) return state
      persistAuthoringMode(action.mode)
      applyAuthoringModeToDocument(action.mode)
      return { ...state, authoringMode: action.mode }
    }
    case 'TOGGLE_CONSOLE':
      if (state.bottomPanelCollapsed || state.bottomPanelTab !== 'console') {
        return syncConsoleOpen({
          ...state,
          bottomPanelTab: 'console',
          bottomPanelCollapsed: false,
        })
      }
      return syncConsoleOpen({ ...state, bottomPanelCollapsed: true })
    case 'SET_CONSOLE_OPEN':
      if (action.open) {
        return syncConsoleOpen({
          ...state,
          bottomPanelTab: 'console',
          bottomPanelCollapsed: false,
        })
      }
      if (state.mode === 'canvas') {
        return syncConsoleOpen({
          ...state,
          bottomPanelTab: 'assets',
          bottomPanelCollapsed: false,
        })
      }
      return syncConsoleOpen({ ...state, bottomPanelCollapsed: true })
    case 'SET_BOTTOM_PANEL_TAB':
      return syncConsoleOpen({
        ...state,
        bottomPanelTab: action.tab,
        bottomPanelCollapsed: false,
      })
    case 'SET_BOTTOM_PANEL_COLLAPSED':
      return state.bottomPanelCollapsed === action.collapsed
        ? state
        : syncConsoleOpen({ ...state, bottomPanelCollapsed: action.collapsed })
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
    case 'SET_SNAP_TO_GRID':
      return state.snapToGrid === action.enabled
        ? state
        : { ...state, snapToGrid: action.enabled }
    case 'EDITOR_SET_ZOOM': {
      // Any explicit user zoom action releases fit-tracking: the user is
      // saying "I want THIS percentage", not "follow the panel".
      const next = clampEditorZoom(action.zoom)
      if (state.editorZoom === next && state.editorZoomMode === 'manual') return state
      return { ...state, editorZoom: next, editorZoomMode: 'manual' }
    }
    case 'EDITOR_SET_FIT_ZOOM': {
      // The fit-to-panel computation dispatches this so panel resizes can
      // re-fit later. Mode stays 'fit'; only the percentage moves.
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
    default:
      return state
  }
}
