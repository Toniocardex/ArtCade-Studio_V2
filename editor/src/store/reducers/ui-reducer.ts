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

export const uiReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'SELECT_ENTITY':
      return { ...state, selection: { ...state.selection, entityId: action.entityId } }
    case 'SELECT_SCENE':
      return {
        ...state,
        selection: { ...state.selection, sceneId: action.sceneId, entityId: null },
      }
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'SET_BOTTOM_TAB':
      return { ...state, bottomTab: action.tab }
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
