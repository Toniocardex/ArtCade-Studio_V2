import type { Dispatch } from 'react'
import type { Action as EditorAction } from '../../store/editor-store'
import {
  saveProjectAsDialog,
  saveProjectFile,
  saveScript,
  scaffoldNewProjectOnDisk,
  resolveScriptPath,
} from '../../utils/api'
import { compileLogicBoard } from '../../utils/logic-board/compiler'
import type { ProjectDoc } from '../../types'
import { makeConsoleEntry } from './makeConsoleEntry'
import { mainScriptBodyForProject } from './project-script'

export type BuildKind = 'Build' | 'WASM' | 'Web'

export async function ensureProjectReadyForBuild(
  kind: BuildKind,
  dispatch: Dispatch<EditorAction>,
  project: ProjectDoc,
  projectPath: string | null,
): Promise<string | null> {
  let buildPath = projectPath ?? ''
  if (!buildPath) {
    const ok = window.confirm('The project has not been saved.\nSave it now before building?')
    if (!ok) return null
    const target = await saveProjectAsDialog(project.projectName)
    if (!target) return null
    try {
      const projectJsonPath = await scaffoldNewProjectOnDisk(
        target,
        project,
        mainScriptBodyForProject(project),
      )
      dispatch({ type: 'LOAD_PROJECT', project, path: projectJsonPath })
      dispatch({ type: 'MARK_PROJECT_SAVED' })
      buildPath = projectJsonPath
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] Saved "${project.projectName}" to ${projectJsonPath}`, 'info'),
      })
    } catch (err) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] ✗ Save failed: ${err}`, 'error'),
      })
      return null
    }
  }

  try {
    await saveProjectFile(buildPath, project)
    dispatch({ type: 'MARK_PROJECT_SAVED' })

    if (project.mainScriptPath && project.logicBoards?.length) {
      const compiled = compileLogicBoard(project.logicBoards ?? [], project)
      await saveScript(resolveScriptPath(buildPath, project.mainScriptPath), compiled)
      dispatch({
        type: 'UPSERT_SCRIPT',
        path: project.mainScriptPath,
        content: compiled,
        isDirty: false,
        activate: false,
      })
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[${kind}] Logic Board compiled -> ${project.mainScriptPath}`, 'info'),
      })
    }
  } catch (err) {
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`[${kind}] Prepare project failed: ${err}`, 'error'),
    })
    return null
  }

  return buildPath
}
