import { useCallback, useState } from 'react'
import type { Dispatch } from 'react'
import {
  runBuild,
  runBuildWasm,
  openWebExportInBrowser,
  ensureDependencies,
} from '../../utils/api'
import { dirName } from '../../utils/project'
import { usePreviewPlayStop } from '../../hooks/usePreviewPlayStop'
import type { Action as EditorAction, CoreState } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { DialogScript } from '../../utils/dialog/dialog-script'
import { makeConsoleEntry } from './makeConsoleEntry'
import { ensureProjectOnDisk } from './ensureProjectOnDisk'
import { planOpenWebExport } from './webExportOpen'
import type { WebExportState } from '../../utils/api'
import { mainScriptBodyForProjectWithStatus } from './project-script'
import { resolveManualMainLua } from '../../utils/project-main-script'

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
  projectPath,
  dialogs,
  webExportState,
  refreshWebExportStatus,
  flushBeforePersist,
  openScripts,
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
      const path = await ensureProjectOnDisk({
        kind,
        dispatch,
        project: flushed,
        projectPath,
        dialogs,
        openScripts,
      })
      if (!path) return null
      const { lua, compileError } = mainScriptBodyForProjectWithStatus(
        flushed,
        path,
        resolveManualMainLua(flushed, openScripts),
      )
      if (compileError) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(`[${kind}] Logic Board compile failed:\n${compileError}`, 'error'),
        })
        return null
      }
      return { path, mainLua: lua }
    },
    [dialogs, dispatch, flushBeforePersist, openScripts, projectPath],
  )

  const handlePlayStop = usePreviewPlayStop()

  const handleBuildExe = useCallback(async () => {
    setIsBuilding(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!(await ensureDependencies('native'))) {
      setIsBuilding(false)
      return
    }
    const prepared = await prepareProject('Build')
    if (!prepared) {
      setIsBuilding(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeConsoleEntry('[Build] Starting cmake build...', 'info') })
    try {
      await runBuild(dirName(prepared.path), prepared.mainLua)
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
    const prepared = await prepareProject('WASM')
    if (!prepared) {
      setIsBuildingWeb(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeConsoleEntry('[WASM] Starting web export...', 'info') })
    try {
      await runBuildWasm(dirName(prepared.path), prepared.mainLua)
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
