// ---------------------------------------------------------------------------
// reducers/project-reducer — project lifecycle and the script buffer list
// ---------------------------------------------------------------------------
//
// Owns:
//   LOAD_PROJECT, MARK_PROJECT_SAVED, MARK_SCRIPT_SAVED,
//   OPEN_SCRIPT, UPSERT_SCRIPT, SET_ACTIVE_SCRIPT, UPDATE_SCRIPT.
//
// Scripts share a module with the project because OPEN_SCRIPT both updates
// the script list and switches the editor mode — keeping it close to
// LOAD_PROJECT (which resets the same fields) avoids a third file.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import { EDITOR_ZOOM_DEFAULT } from '../../constants/editor-viewport'

export const projectReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const firstSceneId = Object.keys(action.project.scenes)[0] ?? null
      // Reset editor "view" chrome so a 400% zoom or an active camera preview
      // from the previous project does not bleed into the freshly loaded one
      // (TECHNICAL_DEBT_REVIEW §7 — LOAD_PROJECT preserved zoom/preview).
      // projectLoadEpoch bump signals PreviewPanel to auto-fit the canvas.
      return {
        ...state,
        project:     action.project,
        projectPath: action.path,
        projectDirty: false,
        selection:   { entityId: null, sceneId: action.project.activeSceneId || firstSceneId },
        openScripts: [],
        activeScriptPath: null,
        isPlaying:   false,
        bottomTab:   'console',
        editorZoom:    EDITOR_ZOOM_DEFAULT,
        cameraPreview: false,
        projectLoadEpoch: state.projectLoadEpoch + 1,
      }
    }
    case 'MARK_PROJECT_SAVED':
      return { ...state, projectDirty: false }
    case 'MARK_SCRIPT_SAVED':
      return {
        ...state,
        openScripts: state.openScripts.map(s =>
          s.path === action.path ? { ...s, isDirty: false } : s
        ),
      }
    case 'UPDATE_SCRIPT': {
      const openScripts = state.openScripts.map(s =>
        s.path === action.path ? { ...s, content: action.content, isDirty: true } : s,
      )
      return { ...state, openScripts }
    }
    case 'OPEN_SCRIPT': {
      const exists = state.openScripts.some(s => s.path === action.file.path)
      return {
        ...state,
        openScripts:      exists ? state.openScripts : [...state.openScripts, action.file],
        activeScriptPath: action.file.path,
        mode:             'script',
      }
    }
    case 'UPSERT_SCRIPT': {
      const isDirty = action.isDirty ?? false
      const exists = state.openScripts.some(s => s.path === action.path)
      const openScripts = exists
        ? state.openScripts.map(s =>
            s.path === action.path ? { ...s, content: action.content, isDirty } : s,
          )
        : [...state.openScripts, { path: action.path, content: action.content, isDirty }]
      return {
        ...state,
        openScripts,
        ...(action.activate ? { activeScriptPath: action.path } : {}),
      }
    }
    case 'SET_ACTIVE_SCRIPT':
      return { ...state, activeScriptPath: action.path }
    default:
      return state
  }
}
