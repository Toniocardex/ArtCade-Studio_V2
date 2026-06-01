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
import { EDITOR_BOOT_ZOOM } from '../../constants/editor-viewport'
import { safeProjectFolderName } from '../../utils/project'
import { emptyProjectHistory } from '../project-history'
import { logicBoardsRevision } from '../../utils/sync-logic-board-script'

export const projectReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const firstSceneId = Object.keys(action.project.scenes)[0] ?? null
      const loadedLogicRev = logicBoardsRevision(action.project) || null
      // Reset editor "view" chrome so a 400% zoom, a stuck fit-mode tracking
      // or an active camera preview from the previous project don't bleed
      // into the freshly loaded one. Every load starts at identity zoom
      // (100%) in manual mode; Ctrl+9 / the dropdown "Fit" entry remain one
      // click away for users who want to see the whole scene at once.
      return {
        ...state,
        project:     action.project,
        projectPath: action.path,
        projectDirty: false,
        selection:   { entityId: null, sceneId: action.project.activeSceneId || firstSceneId },
        openScripts: [],
        activeScriptPath: null,
        isPlaying:   false,
        consoleOpen:           false,
        bottomPanelCollapsed:  true,
        consoleAckUpToId:      0,
        editingTilesetId: null,    // reset tileset sub-view
        editorZoom:       EDITOR_BOOT_ZOOM,
        editorZoomMode:   'manual',
        cameraPreview:    false,
        projectLoadEpoch: state.projectLoadEpoch + 1,
        legacyMigrateBanner: action.migratedFromLegacy ?? false,
        projectHistory: emptyProjectHistory(),
        logicScriptSyncedRevision: loadedLogicRev,
        logicPreviewAppliedRevision: null,
        dialogs: action.dialogs ?? {},
        selectedDialogId:
          action.selectedDialogId ??
          (action.dialogs ? Object.keys(action.dialogs).sort()[0] ?? null : null),
        dialogModal: { open: false, dialogId: null },
        spritesheetStudio: { open: false, imageAssetId: null },
      }
    }
    case 'DISMISS_LEGACY_MIGRATE_BANNER':
      return { ...state, legacyMigrateBanner: false }
    case 'PROJECT_RENAME': {
      if (!state.project) return state
      const projectName = safeProjectFolderName(action.name, 'Untitled')
      if (projectName === state.project.projectName) return state
      return {
        ...state,
        project: { ...state.project, projectName },
        projectDirty: true,
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
