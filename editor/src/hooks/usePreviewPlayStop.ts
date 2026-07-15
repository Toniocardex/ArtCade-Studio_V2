// ---------------------------------------------------------------------------
// usePreviewPlayStop - shared PLAY/STOP for MenuBar and Focus toolbar
// ---------------------------------------------------------------------------

import { useCallback } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import {
  messageForEditorApiCode,
  runtimeSync,
  type PreviewTransitionBundle,
} from '../utils/runtime-sync-service'
import { logLogicBoardCompileFailure } from '../utils/preview-restore'
import { getProjectWorkbenchSnapshot } from '../utils/project-health'
import { buildPreviewSessionBundle } from '../utils/preview-session'
import {
  closeRuntimePreviewSession,
  openRuntimePreviewSession,
} from '../utils/runtime-preview-window'
import { makeConsoleEntry } from '../components/menu-bar/makeConsoleEntry'

export function usePreviewPlayStop(): () => void {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const isPlaying = useEditorSelector((s) => s.isPlaying)
  const openScripts = useEditorSelector((s) => s.openScripts)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const selectionSceneId = useEditorSelector((s) => s.selection.sceneId)

  return useCallback(() => {
    if (isPlaying && isTauri()) {
      void closeRuntimePreviewSession()
        .catch((err) => {
          dispatch({
            type: 'LOG',
            entry: makeConsoleEntry(`[Preview] Stop failed: ${String(err)}`, 'error'),
          })
        })
        .finally(() => {
          dispatch({ type: 'SET_PLAYING', playing: false })
        })
      return
    }

    if (!project) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry('[Preview] No project loaded.', 'warn'),
      })
      return
    }

    let bundle: PreviewTransitionBundle

    if (!isPlaying) {
      const built = buildPreviewSessionBundle({
        project,
        projectPath,
        openScripts,
        dialogs,
        selectionSceneId,
      })
      if (!built.ok) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(built.message, 'error'),
        })
        dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
        return
      }

      logLogicBoardCompileFailure(
        dispatch,
        built.session.compileError,
        makeConsoleEntry,
      )

      if (isTauri()) {
        void openRuntimePreviewSession(built.session.viewportSize, built.session.bundle)
          .then(() => {
            dispatch({ type: 'SET_PLAYING', playing: true })
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
          })
          .catch((err) => {
            dispatch({
              type: 'LOG',
              entry: makeConsoleEntry(`[Preview] Play failed: ${String(err)}`, 'error'),
            })
            dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
            dispatch({ type: 'SET_PLAYING', playing: false })
          })
        return
      }

      bundle = built.session.bundle
    } else {
      const activeSceneId = selectionSceneId ?? project.activeSceneId
      const mainLua = getProjectWorkbenchSnapshot({
        project,
        projectPath,
        openScripts,
        includeCompile: true,
      }).previewLua.lua
      bundle = {
        project,
        activeSceneId,
        mainLua,
        dialogs,
        projectPath,
      }
    }

    const outcome = runtimeSync.transitionPreview(isPlaying ? 'stop' : 'play', bundle)

    if (outcome.nextPlaying !== isPlaying) {
      dispatch({ type: 'SET_PLAYING', playing: outcome.nextPlaying })
    }

    if (!outcome.ok) {
      const label = isPlaying ? 'Stop' : 'Play'
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(
          `[Preview] ${label} failed: ${outcome.message ?? messageForEditorApiCode(outcome.code)}`,
          'error',
        ),
      })
      return
    }

    if (!isPlaying && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [
    dispatch,
    dialogs,
    isPlaying,
    openScripts,
    project,
    projectPath,
    selectionSceneId,
  ])
}
