import { useCallback, useEffect } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { alertDialog, confirmDialog } from '../utils/native-dialog'
import { useTextPrompt } from './useTextPrompt'
import { slugTypeId } from '../utils/project-object-types'
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
  const mode = useEditorSelector((s) => s.mode)
  const sceneId = project ? selection.sceneId ?? project.activeSceneId : ''
  const scene = project?.scenes[sceneId]
  const sceneCount = project ? Object.keys(project.scenes).length : 0
  const isStartScene = Boolean(project && sceneId === project.activeSceneId)
  const canDeleteScene = Boolean(scene && sceneCount > 1 && !isStartScene)

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
      const target = project.scenes[targetSceneId]
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
      const target = project?.scenes[targetSceneId]
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

  // Single entry point for adding objects: prompts for a name, reuses the
  // object type when it already exists, then places an instance in the
  // active scene (Construct-style: scene rows are instances of types).
  const insertObject = useCallback(() => {
    if (!project || !scene) return
    void promptText({
      title: 'Insert object',
      message: 'Object name (instances share the type, e.g. "Coin"):',
      defaultValue: 'Object',
    }).then((name) => {
      if (!name) return
      const typeId = slugTypeId(name)
      const duplicate = Object.values(project.objectTypes ?? {}).find((type) =>
        type.id.toLocaleLowerCase() === typeId.toLocaleLowerCase()
        || type.displayName.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()
      )
      if (duplicate) {
        void alertDialog(
          `An object type named "${duplicate.displayName}" already exists.\n\nUse "Add instance" on that object type, or choose a different name.`,
          { title: 'Object type already exists', kind: 'warning' },
        )
        return
      }
      dispatch({ type: 'OBJECT_TYPE_ADD', displayName: name })
      dispatch({ type: 'INSTANCE_ADD_FROM_TYPE', sceneId, objectTypeId: typeId })
      dispatch({
        type: 'LOG',
        entry: explorerLog(`Inserted ${name} (type ${typeId})`, 'info'),
      })
    })
  }, [scene, sceneId, project, dispatch, promptText])

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
    (entityId: number) => {
      dispatch({
        type: 'SELECT_ENTITY',
        entityId: selection.entityId === entityId ? null : entityId,
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
      const ent = project?.entities[entityId]
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
      if (!project?.scenes[targetSceneId]) return
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
    duplicateEntity,
    deleteEntity,
    openEntityLogic,
    renameEntity,
  }
}
