import { useCallback, useEffect } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { alertDialog, confirmDialog } from '../utils/native-dialog'
import { useTextPrompt } from './useTextPrompt'
import {
  buildCreateObjectAction,
  createObjectErrorMessage,
} from '../utils/object-create'
import { slugTypeId } from '../utils/project-object-types'
import {
  findObjectTypeByDisplayName,
  objectTypeInstanceCountInScene,
} from '../utils/object-type-usage'
import {
  requestDeleteObject,
  type DeleteObjectTarget,
} from '../utils/object-delete-request'
import { defaultEntitySpawnPosition } from '../utils/project'
import { isInstanceNameTakenInScene } from '../utils/project-instance-names'
import {
  openLogicBoardForEntity,
  openLogicBoardForObjectType,
} from '../panels/inspector/logic-board-navigation'
import { useAuthoringCommands } from '../authoring/useAuthoringCommands'

let _explorerLogId = 900

function explorerLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id: ++_explorerLogId,
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    message,
    level,
  }
}

export type SceneExplorerActionsOptions = Readonly<{
  /** When false, Insert is not bound globally (stacked assets pane must not steal it). */
  enableInsertShortcut?: boolean
}>

export function useSceneExplorerActions(options: SceneExplorerActionsOptions = {}) {
  const enableInsertShortcut = options.enableInsertShortcut ?? true
  const dispatch = useEditorDispatch()
  const authoring = useAuthoringCommands()
  const promptText = useTextPrompt()
  const project = useEditorSelector((s) => s.project)
  const selection = useEditorSelector((s) => s.selection)
  const instanceClipboard = useEditorSelector((s) => s.instanceClipboard)
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)
  const editorGridSize = useEditorSelector((s) => s.editorGridSize)
  const mode = useEditorSelector((s) => s.mode)
  const sceneId = project ? selection.sceneId ?? project.activeSceneId : ''
  const scene = project?.scenes?.[sceneId]
  const sceneCount = project ? Object.keys(project.scenes).length : 0
  const isStartScene = Boolean(project && sceneId === project.activeSceneId)
  const canDeleteScene = Boolean(scene && sceneCount > 1 && !isStartScene)
  const canPasteEntity = Boolean(instanceClipboard && instanceClipboard.sceneId === sceneId)

  const addScene = useCallback(() => {
    if (!project) return
    authoring.addScene(sceneId)
  }, [authoring, project, sceneId])

  const selectScene = useCallback(
    (id: string) => {
      dispatch({ type: 'SELECT_SCENE', sceneId: id })
    },
    [dispatch],
  )

  const setStartScene = useCallback(() => {
    if (!scene || isStartScene) return
    authoring.setStartScene(scene.id)
  }, [authoring, scene, isStartScene])

  const setStartSceneById = useCallback(
    (targetSceneId: string) => {
      if (!project || targetSceneId === project.activeSceneId) return
      authoring.setStartScene(targetSceneId)
    },
    [authoring, project],
  )

  const deleteScene = useCallback(() => {
    if (!scene || !canDeleteScene) return
    void confirmDialog(`Delete scene "${scene.name}" and its entities?`, {
      title: 'Delete scene',
      kind: 'warning',
    }).then((ok) => {
      if (ok) authoring.deleteScene(scene.id)
    })
  }, [authoring, canDeleteScene, scene])

  const deleteSceneById = useCallback(
    (targetSceneId: string) => {
      if (!project) return
      const target = project.scenes?.[targetSceneId]
      if (!target) return
      const isStart = targetSceneId === project.activeSceneId
      if (sceneCount <= 1 || isStart) return
      void confirmDialog(`Delete scene "${target.name}" and its entities?`, {
        title: 'Delete scene',
        kind: 'warning',
      }).then((ok) => {
        if (ok) authoring.deleteScene(targetSceneId)
      })
    },
    [authoring, project, sceneCount],
  )

  const renameScene = useCallback(() => {
    if (!scene) return
    void promptText({
      title: 'Rename scene',
      message: 'Scene name:',
      defaultValue: scene.name,
    }).then((name) => {
      if (!name || name === scene.name) return
      authoring.renameScene(scene.id, name)
    })
  }, [authoring, scene, promptText])

  const renameSceneById = useCallback(
    (targetSceneId: string) => {
      const target = project?.scenes?.[targetSceneId]
      if (!target) return
      void promptText({
        title: 'Rename scene',
        message: 'Scene name:',
        defaultValue: target.name,
      }).then((name) => {
        if (!name || name === target.name) return
        authoring.renameScene(targetSceneId, name)
      })
    },
    [authoring, project, promptText],
  )

  // Single entry point for adding objects: prompts for a name, creates a new
  // object type + first scene instance atomically (Construct-style hierarchy).
  const insertObject = useCallback(() => {
    if (!project || !scene) return
    void promptText({
      title: 'Insert object',
      message: 'Object name (instances share the type, e.g. "Coin"):',
      defaultValue: 'Object',
    }).then((name) => {
      if (!name) return
      const spawn = defaultEntitySpawnPosition(scene, editorGridSize, snapToGrid)
      const result = buildCreateObjectAction({
        project,
        sceneId,
        displayName: name,
        position: spawn,
      })
      if (!result.ok) {
        const existingType =
          findObjectTypeByDisplayName(project, name)
          ?? project.objectTypes?.[slugTypeId(name)]
        if (
          existingType
          && objectTypeInstanceCountInScene(project, sceneId, existingType.id) === 0
          && (result.error === 'duplicate-name' || result.error === 'duplicate-type-id')
        ) {
          void confirmDialog(
            `"${existingType.displayName}" already exists but has no instances in the current scene.\n\nAdd an instance of this object type?`,
            { title: 'Object type already exists', kind: 'info' },
          ).then((ok) => {
            if (ok) {
              authoring.addInstanceFromType(sceneId, existingType.id)
            }
          })
          return
        }
        void alertDialog(createObjectErrorMessage(result.error, name), {
          title: result.error === 'duplicate-type-id'
            ? 'Object type id already exists'
            : 'Object type already exists',
          kind: 'warning',
        })
        return
      }
      authoring.createObject(result.action)
      dispatch({
        type: 'LOG',
        entry: explorerLog(`Inserted ${name} (type ${result.action.objectType.id})`, 'info'),
      })
    })
  }, [scene, sceneId, project, authoring, dispatch, promptText, editorGridSize, snapToGrid])

  // Places a new instance of an existing object type in the active scene
  // (group-level "Add instance" in the explorer).
  const addInstanceOfType = useCallback(
    (objectTypeId: string) => {
      if (!project?.objectTypes?.[objectTypeId] || !scene) return
      authoring.addInstanceFromType(sceneId, objectTypeId)
    },
    [authoring, project, scene, sceneId],
  )

  const selectEntity = useCallback(
    (entityId: number, additive = false) => {
      dispatch({
        type: 'SELECT_ENTITY',
        entityId: !additive && selection.entityId === entityId ? null : entityId,
        additive,
      })
    },
    [dispatch, selection.entityId],
  )

  const toggleEntityVisible = useCallback(
    (entityId: number, currentlyVisible: boolean) => {
      authoring.setInstanceVisible(entityId, !currentlyVisible)
    },
    [authoring],
  )

  const duplicateEntity = useCallback(
    (entityId: number) => {
      authoring.duplicateInstance(sceneId, entityId)
    },
    [authoring, sceneId],
  )

  const copyEntity = useCallback(
    (entityId: number) => {
      dispatch({ type: 'INSTANCE_COPY', instanceId: entityId, sceneId })
    },
    [dispatch, sceneId],
  )

  const pasteEntity = useCallback(() => {
    const offset = snapToGrid && Number.isFinite(editorGridSize) && editorGridSize > 0
      ? editorGridSize
      : 16
    const position = instanceClipboard
      ? {
          x: instanceClipboard.instance.transform.position.x + offset,
          y: instanceClipboard.instance.transform.position.y + offset,
        }
      : undefined
    dispatch({ type: 'INSTANCE_PASTE', sceneId, position })
  }, [dispatch, editorGridSize, instanceClipboard, sceneId, snapToGrid])

  const requestDeleteObjectTarget = useCallback(
    (target: DeleteObjectTarget) => {
      void requestDeleteObject({
        project: project ?? null,
        target,
        deleteInstance: authoring.deleteInstance,
        deleteObjectType: authoring.deleteObjectType,
      })
    },
    [authoring, project],
  )

  const renameObjectType = useCallback(
    (objectTypeId: string) => {
      const type = project?.objectTypes?.[objectTypeId]
      if (!type) return
      void promptText({
        title: 'Rename object type',
        message: 'Object type name:',
        defaultValue: type.displayName,
      }).then((displayName) => {
        if (!displayName || displayName === type.displayName) return
        authoring.renameObjectType(objectTypeId, displayName)
      })
    },
    [authoring, project, promptText],
  )

  const openObjectTypeLogic = useCallback(
    (objectTypeId: string) => {
      if (!project) return
      openLogicBoardForObjectType(dispatch, project, objectTypeId, sceneId)
    },
    [dispatch, project, sceneId],
  )

  const openEntityLogic = useCallback(
    (entityId: number) => {
      openLogicBoardForEntity(dispatch, entityId)
    },
    [dispatch],
  )

  const renameEntity = useCallback(
    (entityId: number) => {
      const ent = project?.entities?.[entityId]
      if (!ent) return
      void promptText({
        title: 'Rename instance',
        message: 'Instance name:',
        defaultValue: ent.name,
      }).then((name) => {
        if (!name || name === ent.name) return
        if (project && isInstanceNameTakenInScene(project, sceneId, name, entityId)) {
          void alertDialog(
            `An object named "${name}" already exists in this scene.\n\nChoose a different instance name.`,
            { title: 'Instance name already exists', kind: 'warning' },
          )
          return
        }
        authoring.renameInstance(entityId, name)
      })
    },
    [authoring, project, promptText, sceneId],
  )

  const duplicateSceneById = useCallback(
    (targetSceneId: string) => {
      if (!project?.scenes?.[targetSceneId]) return
      authoring.duplicateScene(targetSceneId)
    },
    [authoring, project],
  )

  useEffect(() => {
    if (!enableInsertShortcut) return
    function handleKeyDown(e: KeyboardEvent) {
      if (mode !== 'canvas') return
      const isInsert = e.key === 'Insert'
      if (!isInsert) return
      if (!scene) return
      e.preventDefault()
      insertObject()
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [enableInsertShortcut, mode, scene, insertObject])

  return {
    project,
    sceneId,
    scene,
    selection,
    isStartScene,
    canDeleteScene,
    canPasteEntity,
    sceneCount,
    addScene,
    selectScene,
    setStartScene,
    setStartSceneById,
    deleteScene,
    deleteSceneById,
    renameScene,
    renameSceneById,
    duplicateSceneById,
    insertObject,
    addInstanceOfType,
    selectEntity,
    toggleEntityVisible,
    copyEntity,
    pasteEntity,
    duplicateEntity,
    requestDeleteObject: requestDeleteObjectTarget,
    renameObjectType,
    openObjectTypeLogic,
    openEntityLogic,
    renameEntity,
  }
}
