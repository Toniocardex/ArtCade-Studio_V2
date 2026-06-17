import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from '../editor-store'
import { emptyDialogScript } from '../../utils/dialog/dialog-script'
import type { ProjectDoc } from '../../types'
import { DEFAULT_DOCK_PANEL_VISIBILITY } from '../../constants/dock-panels'

function emptyProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {},
  }
}

function baseState(): CoreState {
  return {
    project: emptyProject(),
    projectPath: null,
    projectDirty: false,
    selection: { entityId: null, sceneId: 's' },
    mode: 'canvas',
    consoleOpen: false,
    bottomPanelCollapsed: true,
    dockPanelVisibility: DEFAULT_DOCK_PANEL_VISIBILITY,
    consoleAckUpToId: 0,
    activePaintTilesetId: null,
    tilePaletteOpen: false,
    lastPaintTilesetByLayer: {},
    recentPaintTilesetIds: [],
    paintSourceNotice: null,
    openScripts: [],
    activeScriptPath: null,
    isPlaying: false,
    selectedTileCell: 1,
    editorGridSize: 32,
    snapToGrid: false,
    editorZoom: 1.0,
    editorZoomMode: 'manual',
    cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
    dialogs: { innkeeper: emptyDialogScript('innkeeper') },
    selectedDialogId: 'innkeeper',
    dialogModal: { open: false, dialogId: null },
    spritesheetStudio: { open: false, imageAssetId: null },
  }
}

describe('dialogReducer', () => {
  it('DIALOG_CREATE rejects duplicate ids', () => {
    const s = coreReducer(baseState(), { type: 'DIALOG_CREATE', dialogId: 'innkeeper' })
    expect(s.dialogs.innkeeper).toBeDefined()
    expect(Object.keys(s.dialogs)).toHaveLength(1)
  })

  it('DIALOG_RENAME moves script and updates selection', () => {
    const s = coreReducer(baseState(), {
      type: 'DIALOG_RENAME',
      fromId: 'innkeeper',
      toId: 'barkeep',
    })
    expect(s.dialogs.barkeep).toBeDefined()
    expect(s.dialogs.innkeeper).toBeUndefined()
    expect(s.selectedDialogId).toBe('barkeep')
    expect(s.projectDirty).toBe(true)
  })

  it('DIALOG_DELETE selects next dialog alphabetically', () => {
    const withTwo = coreReducer(baseState(), { type: 'DIALOG_CREATE', dialogId: 'zebra' })
    const s = coreReducer(withTwo, { type: 'DIALOG_DELETE', dialogId: 'innkeeper' })
    expect(s.dialogs.innkeeper).toBeUndefined()
    expect(s.selectedDialogId).toBe('zebra')
  })

  it('DIALOG_SET_LIBRARY closes modal and picks selection', () => {
    const open = coreReducer(baseState(), {
      type: 'DIALOG_OPEN_MODAL',
      dialogId: 'innkeeper',
    })
    const s = coreReducer(open, {
      type: 'DIALOG_SET_LIBRARY',
      dialogs: { a: emptyDialogScript('a') },
      selectedDialogId: 'a',
    })
    expect(s.dialogModal.open).toBe(false)
    expect(s.selectedDialogId).toBe('a')
  })
})
