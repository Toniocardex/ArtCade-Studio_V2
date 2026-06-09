// ---------------------------------------------------------------------------
// usePreviewPlayStop — shared PLAY/STOP for MenuBar and Focus toolbar
// ---------------------------------------------------------------------------

import { useCallback } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import {
  runtimeSync,
  messageForEditorApiCode,
  type PreviewTransitionBundle,
} from '../utils/runtime-sync-service'
import { logLogicBoardCompileFailure } from '../utils/preview-restore'
import {
  formatHealthSummary,
  getProjectWorkbenchSnapshot,
} from '../utils/project-health'
import { makeConsoleEntry } from '../components/menu-bar/makeConsoleEntry'

export function usePreviewPlayStop(): () => void {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const isPlaying = useEditorSelector((s) => s.isPlaying)
  const mode = useEditorSelector((s) => s.mode)
  const openScripts = useEditorSelector((s) => s.openScripts)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const selectionSceneId = useEditorSelector((s) => s.selection.sceneId)

  return useCallback(() => {
    if (!project) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry('[Preview] No project loaded.', 'warn'),
      })
      return
    }

    const activeSceneId = selectionSceneId ?? project.activeSceneId
    let mainLua: string
    if (isPlaying) {
      mainLua = getProjectWorkbenchSnapshot({
        project,
        projectPath,
        openScripts,
        includeCompile: true,
      }).previewLua.lua
    } else {
      const workbench = getProjectWorkbenchSnapshot({
        project,
        projectPath,
        openScripts,
        includeCompile: true,
      })
      if (workbench.health.blocksPlay) {
        const summary = formatHealthSummary(workbench.health)
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(
            `[Preview] Play blocked — fix project issues first.${summary ? `\n${summary}` : ''}`,
            'error',
          ),
        })
        dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
        return
      }
      logLogicBoardCompileFailure(dispatch, workbench.previewLua.compileError, makeConsoleEntry)
      mainLua = workbench.previewLua.lua
    }

    const bundle: PreviewTransitionBundle = {
      project,
      activeSceneId,
      mainLua,
      dialogs,
      projectPath,
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

    if (!isPlaying) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      if (mode !== 'canvas') {
        dispatch({ type: 'SET_MODE', mode: 'canvas' })
      }
    }
  }, [
    dispatch,
    dialogs,
    isPlaying,
    mode,
    openScripts,
    project,
    projectPath,
    selectionSceneId,
  ])
}
