import { useCallback, useEffect } from 'react'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { confirmDialog } from '../utils/native-dialog'
import { useTextPrompt } from './useTextPrompt'
import {
  createEntityDef,
  nextEntityId,
  objectTypeDisplayLabel,
} from '../utils/project'
import { openLogicBoardForEntity } from '../panels/inspector/logic-board-navigation'

let _explorerLogId = 900

function explorerLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id: ++_explorerLogId,
    time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    message,
    level,
  }
}

export function useSceneExplorerActions() {
  const { state, dispatch } = useEditor()
  const promptText = useTextPrompt()
  const { project, selection, mode } = state
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

  const deleteScene = useCallback(() => {
    if (!scene || !canDeleteScene) return
    void confirmDialog(`Delete scene "${scene.name}" and its entities?`, {
      title: 'Delete scene',
      kind: 'warning',
    }).then((ok) => {
      if (ok) dispatch({ type: 'SCENE_DELETE', sceneId: scene.id })
    })
  }, [canDeleteScene, dispatch, scene])

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

  const addEntity = useCallback(() => {
    if (!project || !scene) return
    const id = nextEntityId(project)
    const preview = createEntityDef(id)
    dispatch({ type: 'ENTITY_ADD', sceneId })
    dispatch({
      type: 'LOG',
      entry: explorerLog(`Added ${preview.name} — rename in Inspector`, 'info'),
    })
  }, [scene, sceneId, project, dispatch])

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
      dispatch({ type: 'ENTITY_DUPLICATE', entityId, sceneId })
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

  const addEntityType = useCallback(() => {
    void promptText({
      title: 'New entity type',
      message: 'Type name (reusable template):',
      defaultValue: 'Entity',
    }).then((name) => {
      if (!name) return
      dispatch({ type: 'OBJECT_TYPE_ADD', displayName: name })
    })
  }, [dispatch, promptText])

  const placeEntityType = useCallback(
    (objectTypeId: string) => {
      if (!scene || !project) return
      dispatch({ type: 'INSTANCE_ADD_FROM_TYPE', sceneId, objectTypeId })
      dispatch({
        type: 'LOG',
        entry: explorerLog(
          `Placed ${objectTypeDisplayLabel(project, objectTypeId)} in scene`,
          'info',
        ),
      })
    },
    [dispatch, project, scene, sceneId],
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (mode !== 'canvas') return
      const isInsert = e.key === 'Insert'
      if (!isInsert) return
      if (!scene) return
      e.preventDefault()
      addEntity()
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [mode, scene, addEntity])

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
    deleteScene,
    renameScene,
    addEntity,
    selectEntity,
    toggleEntityVisible,
    duplicateEntity,
    deleteEntity,
    openEntityLogic,
    addEntityType,
    placeEntityType,
  }
}
