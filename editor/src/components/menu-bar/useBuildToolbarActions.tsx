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
import { resolvePreviewMainLua } from '../../utils/preview-restore'
import type { Action as EditorAction, CoreState } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import { makeConsoleEntry } from './makeConsoleEntry'
import { ensureProjectOnDisk } from './ensureProjectOnDisk'

interface UseBuildToolbarActionsParams {
  dispatch: Dispatch<EditorAction>
  project: ProjectDoc | null
  projectPath: string | null
  isPlaying: boolean
  openScripts: CoreState['openScripts']
  selectionSceneId: string | null | undefined
  flushBeforePersist: () => ProjectDoc | null
}

export function useBuildToolbarActions({
  dispatch,
  project,
  projectPath,
  isPlaying,
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
      })
    },
    [dispatch, flushBeforePersist, projectPath],
  )

  const handlePlayStop = useCallback(() => {
    if (isPlaying) {
      dispatch({ type: 'SET_PLAYING', playing: false })
      if (project) {
        const activeSceneId = selectionSceneId ?? project.activeSceneId
        const mainLua = resolvePreviewMainLua({ project, openScripts })
        const ok = runtimeSync.restorePreviewFromProject(project, activeSceneId, mainLua)
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
      dispatch({ type: 'SET_PLAYING', playing: true })
    }
  }, [dispatch, isPlaying, openScripts, project, selectionSceneId])

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
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[WASM] Failed: ${err}`, 'error') })
    } finally {
      setIsBuildingWeb(false)
    }
  }, [dispatch, prepareProject])

  const handleOpenWebInBrowser = useCallback(async () => {
    if (!project) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[Web] No project loaded.', 'warn') })
      return
    }
    setIsOpeningWeb(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    const root = await prepareProject('Web')
    if (!root) {
      setIsOpeningWeb(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeConsoleEntry('[Web] Starting local preview server...', 'info') })
    try {
      const url = await openWebExportInBrowser(dirName(root))
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Web] Browser opened at ${url}`, 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Web] ${err}`, 'error') })
    } finally {
      setIsOpeningWeb(false)
    }
  }, [dispatch, prepareProject, project])

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
