import { useCallback, useState } from 'react'
import type { Dispatch } from 'react'
import {
  runBuild,
  runBuildWasm,
  openWebExportInBrowser,
  ensureDependencies,
} from '../../utils/api'
import { dirName } from '../../utils/project'
import { runtimeSync } from '../../utils/runtime-sync-service'
import {
  logLogicBoardCompileFailure,
  resolvePreviewMainLua,
  resolvePreviewMainLuaWithStatus,
} from '../../utils/preview-restore'
import type { Action as EditorAction, CoreState } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { DialogScript } from '../../utils/dialog/dialog-script'
import { makeConsoleEntry } from './makeConsoleEntry'
import { ensureProjectOnDisk } from './ensureProjectOnDisk'
import { planOpenWebExport } from './webExportOpen'
import type { WebExportState } from '../../utils/api'

interface UseBuildToolbarActionsParams {
  dispatch: Dispatch<EditorAction>
  project: ProjectDoc | null
  projectPath: string | null
  dialogs: Record<string, DialogScript>
  webExportState: WebExportState
  refreshWebExportStatus: (opts?: { projectDirty?: boolean }) => Promise<void>
  isPlaying: boolean
  mode: CoreState['mode']
  openScripts: CoreState['openScripts']
  selectionSceneId: string | null | undefined
  flushBeforePersist: () => ProjectDoc | null
}

export function useBuildToolbarActions({
  dispatch,
  project,
  projectPath,
  dialogs,
  webExportState,
  refreshWebExportStatus,
  isPlaying,
  mode,
  openScripts,
  selectionSceneId,
  flushBeforePersist,
}: UseBuildToolbarActionsParams) {
  const [isBuilding, setIsBuilding] = useState(false)
  const [isBuildingWeb, setIsBuildingWeb] = useState(false)
  const [isOpeningWeb, setIsOpeningWeb] = useState(false)

  const buildBusy = isBuilding || isBuildingWeb || isOpeningWeb

  const prepareProject = useCallback(
    async (kind: 'Build' | 'WASM' | 'Web') => {
      const flushed = flushBeforePersist()
      if (!flushed) {
        dispatch({ type: 'LOG', entry: makeConsoleEntry(`[${kind}] No project loaded.`, 'warn') })
        return null
      }
      return ensureProjectOnDisk({
        kind,
        dispatch,
        project: flushed,
        projectPath,
        dialogs,
      })
    },
    [dialogs, dispatch, flushBeforePersist, projectPath],
  )

  const handlePlayStop = useCallback(() => {
    if (isPlaying) {
      dispatch({ type: 'SET_PLAYING', playing: false })
      if (project) {
        const activeSceneId = selectionSceneId ?? project.activeSceneId
        const mainLua = resolvePreviewMainLua({ project, openScripts, projectPath })
        const ok = runtimeSync.restorePreviewFromProject(
          project, activeSceneId, mainLua, dialogs, projectPath,
        )
        if (!ok) {
          dispatch({
            type: 'LOG',
            entry: makeConsoleEntry(
              '[Preview] Runtime not ready — open Canvas preview first.',
              'warn',
            ),
          })
        }
      }
    } else {
      if (project) {
        const { lua: mainLua, compileError } = resolvePreviewMainLuaWithStatus({
          project,
          openScripts,
          projectPath,
        })
        logLogicBoardCompileFailure(dispatch, compileError, makeConsoleEntry)
        if (!runtimeSync.preparePlaySession(mainLua, dialogs)) {
          dispatch({
            type: 'LOG',
            entry: makeConsoleEntry(
              '[Preview] Runtime not ready — open Canvas preview first.',
              'warn',
            ),
          })
          return
        }
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      if (mode !== 'canvas') {
        dispatch({ type: 'SET_MODE', mode: 'canvas' })
      }
      dispatch({ type: 'SET_PLAYING', playing: true })
    }
  }, [dispatch, dialogs, isPlaying, mode, openScripts, project, projectPath, selectionSceneId])

  const handleBuildExe = useCallback(async () => {
    setIsBuilding(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!(await ensureDependencies('native'))) {
      setIsBuilding(false)
      return
    }
    const preparedBuildPath = await prepareProject('Build')
    if (!preparedBuildPath) {
      setIsBuilding(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeConsoleEntry('[Build] Starting cmake build...', 'info') })
    try {
      await runBuild(dirName(preparedBuildPath))
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Build] Failed: ${err}`, 'error') })
    } finally {
      setIsBuilding(false)
    }
  }, [dispatch, prepareProject])

  const handleBuildWeb = useCallback(async () => {
    setIsBuildingWeb(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!(await ensureDependencies('wasm'))) {
      setIsBuildingWeb(false)
      return
    }
    const buildPath = await prepareProject('WASM')
    if (!buildPath) {
      setIsBuildingWeb(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeConsoleEntry('[WASM] Starting web export...', 'info') })
    try {
      await runBuildWasm(dirName(buildPath))
      await refreshWebExportStatus({ projectDirty: false })
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry('[WASM] Web export ready — click OPEN IN BROWSER to preview.', 'info'),
      })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[WASM] Failed: ${err}`, 'error') })
    } finally {
      setIsBuildingWeb(false)
    }
  }, [dispatch, prepareProject, refreshWebExportStatus])

  const handleOpenWebInBrowser = useCallback(async () => {
    const plan = planOpenWebExport(projectPath, webExportState)
    if (plan.kind === 'skip') {
      return
    }
    setIsOpeningWeb(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    dispatch({ type: 'LOG', entry: makeConsoleEntry('[Web] Starting local preview server...', 'info') })
    try {
      const url = await openWebExportInBrowser(plan.projectRoot)
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Web] Browser opened at ${url}`, 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Web] ${err}`, 'error') })
    } finally {
      setIsOpeningWeb(false)
    }
  }, [dispatch, projectPath, webExportState])

  return {
    buildBusy,
    isBuilding,
    isBuildingWeb,
    isOpeningWeb,
    handlePlayStop,
    handleBuildExe,
    handleBuildWeb,
    handleOpenWebInBrowser,
  }
}
