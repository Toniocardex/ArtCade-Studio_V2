import { useCallback, useEffect } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { alertDialog, confirmDialog } from '../utils/native-dialog'
import { useTextPrompt } from './useTextPrompt'
import {
  buildCreateObjectAction,
  createObjectErrorMessage,
} from '../utils/object-create'
import { defaultEntitySpawnPosition } from '../utils/project'
import { isInstanceNameTakenInScene } from '../utils/project-instance-names'
import { openLogicBoardForEntity } from '../panels/inspector/logic-board-navigation'

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

export function useSceneExplorerActions() {
  const dispatch = useEditorDispatch()
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
    dispatch({ type: 'SCENE_ADD_EMPTY', sourceSceneId: sceneId })
  }, [dispatch, project, sceneId])

  const selectScene = useCallback(
    (id: string) => {
      dispatch({ type: 'SELECT_SCENE', sceneId: id })
    },
    [dispatch],
  )

  const setStartScene = useCallback(() => {
    if (!scene || isStartScene) return
    dispatch({ type: 'SCENE_SET_START', sceneId: scene.id })
  }, [dispatch, scene, isStartScene])

  const setStartSceneById = useCallback(
    (targetSceneId: string) => {
      if (!project || targetSceneId === project.activeSceneId) return
      dispatch({ type: 'SCENE_SET_START', sceneId: targetSceneId })
    },
    [dispatch, project],
  )

  const deleteScene = useCallback(() => {
    if (!scene || !canDeleteScene) return
    void confirmDialog(`Delete scene "${scene.name}" and its entities?`, {
      title: 'Delete scene',
      kind: 'warning',
    }).then((ok) => {
      if (ok) dispatch({ type: 'SCENE_DELETE', sceneId: scene.id })
    })
  }, [canDeleteScene, dispatch, scene])

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
        if (ok) dispatch({ type: 'SCENE_DELETE', sceneId: targetSceneId })
      })
    },
    [dispatch, project, sceneCount],
  )

  const renameScene = useCallback(() => {
    if (!scene) return
    void promptText({
      title: 'Rename scene',
      message: 'Scene name:',
      defaultValue: scene.name,
    }).then((name) => {
      if (!name || name === scene.name) return
      dispatch({ type: 'SCENE_RENAME', sceneId: scene.id, name })
    })
  }, [dispatch, scene, promptText])

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
        dispatch({ type: 'SCENE_RENAME', sceneId: targetSceneId, name })
      })
    },
    [dispatch, project, promptText],
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
        void alertDialog(createObjectErrorMessage(result.error, name), {
          title: result.error === 'duplicate-type-id'
            ? 'Object type id already exists'
            : 'Object type already exists',
          kind: 'warning',
        })
        return
      }
      dispatch(result.action)
      dispatch({
        type: 'LOG',
        entry: explorerLog(`Inserted ${name} (type ${result.action.objectType.id})`, 'info'),
      })
    })
  }, [scene, sceneId, project, dispatch, promptText, editorGridSize, snapToGrid])

  // Places a new instance of an existing object type in the active scene
  // (group-level "Add instance" in the explorer).
  const addInstanceOfType = useCallback(
    (objectTypeId: string) => {
      if (!project?.objectTypes?.[objectTypeId] || !scene) return
      dispatch({ type: 'INSTANCE_ADD_FROM_TYPE', sceneId, objectTypeId })
    },
    [dispatch, project, scene, sceneId],
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
      dispatch({ type: 'ENTITY_SET_VISIBLE', entityId, visible: !currentlyVisible })
    },
    [dispatch],
  )

  const duplicateEntity = useCallback(
    (entityId: number) => {
      dispatch({ type: 'INSTANCE_DUPLICATE', instanceId: entityId, sceneId })
    },
    [dispatch, sceneId],
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

  const deleteEntity = useCallback(
    (entityId: number) => {
      dispatch({ type: 'ENTITY_DELETE', entityId })
    },
    [dispatch],
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
        title: 'Rename entity',
        message: 'Entity name:',
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
        dispatch({ type: 'ENTITY_SET_NAME', entityId, name })
      })
    },
    [dispatch, project, promptText, sceneId],
  )

  const duplicateSceneById = useCallback(
    (targetSceneId: string) => {
      if (!project?.scenes?.[targetSceneId]) return
      dispatch({ type: 'SCENE_DUPLICATE', sceneId: targetSceneId })
    },
    [dispatch, project],
  )

  useEffect(() => {
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
  }, [mode, scene, insertObject])

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
    deleteEntity,
    openEntityLogic,
    renameEntity,
  }
}
