import { describe, expect, it } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import type { ProjectDoc } from '../types'
import { DEFAULT_DOCK_PANEL_VISIBILITY } from '../constants/dock-panels'
import { createBlankProject } from '../utils/project-factory'
import { createEntityDef } from '../utils/project-builders'
import { migrateLegacyProject } from '../utils/project-object-types'

function project(name = 'Original'): ProjectDoc {
  return {
    projectName: name,
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 'scene_main',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {},
  }
}

function baseState(p: ProjectDoc | null = project()): CoreState {
  return {
    project: p,
    projectPath: null,
    projectDirty: false,
    selection: { entityId: null, sceneId: null },
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
    editorZoom: 1,
    editorZoomMode: 'manual',
    cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
    dialogs: {},
    selectedDialogId: null,
    dialogModal: { open: false, dialogId: null },
    spritesheetStudio: { open: false, imageAssetId: null },
  }
}

describe('coreReducer - project metadata', () => {
  it('renames the project and marks it dirty', () => {
    const s = coreReducer(baseState(), { type: 'PROJECT_RENAME', name: 'My Game' })

    expect(s.project?.projectName).toBe('My Game')
    expect(s.projectDirty).toBe(true)
  })

  it('LOAD_PROJECT closes Spritesheet Studio modal', () => {
    const open = coreReducer(baseState(), {
      type: 'SPRITESHEET_STUDIO_OPEN',
      imageAssetId: 'img_a',
    })
    expect(open.spritesheetStudio.open).toBe(true)
    const loaded = coreReducer(open, {
      type: 'LOAD_PROJECT',
      project: project('Next'),
      path: '/tmp/next.artcade',
    })
    expect(loaded.spritesheetStudio).toEqual({ open: false, imageAssetId: null })
  })

  it('LOAD_PROJECT resets canvas zoom to 100% manual mode', () => {
    const loaded = coreReducer(
      { ...baseState(), editorZoom: 2.48, editorZoomMode: 'fit' },
      {
        type: 'LOAD_PROJECT',
        project: project('Next'),
        path: '/tmp/next.artcade',
      },
    )

    expect(loaded.editorZoom).toBe(1)
    expect(loaded.editorZoomMode).toBe('manual')
  })

  it('LOAD_PROJECT rematerializes v3 entities from object types and drops stale cache rows', () => {
    const loadedProject = migrateLegacyProject({
      ...createBlankProject('Loaded'),
      entities: { 1: createEntityDef(1, 'Player', 'Player') },
      scenes: {
        scene_main: {
          ...createBlankProject().scenes.scene_main,
          entityIds: [1],
        },
      },
    })
    loadedProject.entities[20_4160] = createEntityDef(20_4160, 'Stale', 'Stale')

    const loaded = coreReducer(baseState(), {
      type: 'LOAD_PROJECT',
      project: loadedProject,
      path: '/tmp/loaded.artcade',
    })

    expect(loaded.project?.entities[1]?.className).toBe('Player')
    expect(loaded.project?.entities[20_4160]).toBeUndefined()
  })

  it('falls back to Untitled when the provided name is empty', () => {
    const s = coreReducer(baseState(project('Old')), { type: 'PROJECT_RENAME', name: '   ' })

    expect(s.project?.projectName).toBe('Untitled')
    expect(s.projectDirty).toBe(true)
  })

  it('sanitises names before persisting them in project state', () => {
    const s = coreReducer(baseState(), { type: 'PROJECT_RENAME', name: 'Bad:/Name' })

    expect(s.project?.projectName).toBe('Bad__Name')
  })
})
