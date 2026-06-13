import type { Dispatch } from 'react'
import type { Action as EditorAction } from '../../store/editor-store'
import {
  saveProjectAsDialog,
  saveProjectFile,
  saveScript,
  scaffoldNewProjectOnDisk,
  resolveScriptPath,
  copyProjectDataDirs,
} from '../../utils/api'
import {
  dirName,
  projectFolderBaseName,
  projectRootFromProjectPath,
  safeProjectFolderName,
} from '../../utils/project'
import type { ProjectDoc } from '../../types'
import { makeConsoleEntry } from './makeConsoleEntry'
import { mainScriptBodyForProject, mainScriptBodyForProjectWithStatus } from './project-script'
import { saveDialogsToProject } from '../../utils/dialog/dialog-file-api'
import type { DialogScript } from '../../utils/dialog/dialog-script'
import { starterInnkeeperScript } from '../../utils/dialog/dialog-file-api'
import { confirmDialog } from '../../utils/native-dialog'

export type PersistKind = 'Build' | 'WASM' | 'Web' | 'save'

interface EnsureProjectOnDiskOptions {
  kind: PersistKind
  dispatch: Dispatch<EditorAction>
  project: ProjectDoc
  projectPath: string | null
  dialogs: Record<string, DialogScript>
}

function buildConfirmMessage(kind: PersistKind): string {
  if (kind === 'save') {
    return 'The project has not been saved.\nChoose a parent folder now?'
  }
  return 'The project has not been saved.\nSave it now before building?'
}

async function scaffoldIntoParent(
  parentDir: string,
  project: ProjectDoc,
  dialogs: Record<string, DialogScript>,
  dispatch: Dispatch<EditorAction>,
  logPrefix: string,
): Promise<string | null> {
  try {
    const projectJsonPath = await scaffoldNewProjectOnDisk(
      parentDir,
      project,
      mainScriptBodyForProject(project),
    )
    const library =
      Object.keys(dialogs).length > 0
        ? dialogs
        : { innkeeper: starterInnkeeperScript() }
    await saveDialogsToProject(projectJsonPath, library)
    dispatch({
      type: 'LOAD_PROJECT',
      project,
      path: projectJsonPath,
      dialogs: library,
      selectedDialogId: Object.keys(library).sort()[0] ?? null,
    })
    dispatch({ type: 'MARK_PROJECT_SAVED' })
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`${logPrefix} Saved "${project.projectName}" to ${projectJsonPath}`, 'info'),
    })
    return projectJsonPath
  } catch (err) {
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`${logPrefix} Save failed: ${err}`, 'error'),
    })
    return null
  }
}

async function migrateProjectFolder(
  opts: EnsureProjectOnDiskOptions,
  folderName: string,
): Promise<string | null> {
  const { dispatch, project, projectPath } = opts
  if (!projectPath) return null

  const oldRoot = projectRootFromProjectPath(projectPath)
  const oldFolder = projectFolderBaseName(projectPath)
  const defaultParent = dirName(oldRoot)

  const ok = await confirmDialog(
    `Project is named "${folderName}" but saved in folder "${oldFolder}".\n` +
      `Save a copy into a new "${folderName}" folder?`,
    { title: 'Project folder name', kind: 'warning' },
  )
  if (!ok) return null

  const parentDir = await saveProjectAsDialog(folderName, { defaultPath: defaultParent })
  if (!parentDir) return null

  const projectJsonPath = await scaffoldIntoParent(
    parentDir,
    project,
    opts.dialogs,
    dispatch,
    '[File]',
  )
  if (!projectJsonPath) return null

  const newRoot = projectRootFromProjectPath(projectJsonPath)
  try {
    await copyProjectDataDirs(oldRoot, newRoot)
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`[File] Migrated assets/scripts to ${newRoot}`, 'info'),
    })
  } catch (err) {
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`[File] Migration copy warning: ${err}`, 'warn'),
    })
  }

  return projectJsonPath
}

export async function ensureProjectOnDisk(
  opts: EnsureProjectOnDiskOptions,
): Promise<string | null> {
  const { kind, dispatch, project, projectPath, dialogs } = opts
  const folderName = safeProjectFolderName(project.projectName, 'Untitled')
  const logPrefix = kind === 'save' ? '[File]' : `[${kind}]`

  let buildPath = projectPath ?? ''

  if (!buildPath) {
    const ok = await confirmDialog(buildConfirmMessage(kind), {
      title: 'Save project',
      kind: 'warning',
    })
    if (!ok) return null
    const parentDir = await saveProjectAsDialog(folderName)
    if (!parentDir) return null
    buildPath =
      (await scaffoldIntoParent(parentDir, project, dialogs, dispatch, logPrefix)) ?? ''
    if (!buildPath) return null
  } else if (projectFolderBaseName(buildPath) !== folderName) {
    const migrated = await migrateProjectFolder(opts, folderName)
    if (!migrated) return null
    buildPath = migrated
  }

  try {
    await saveDialogsToProject(buildPath, dialogs)

    if (project.mainScriptPath && project.logicBoards?.length) {
      const { lua, compileError } = mainScriptBodyForProjectWithStatus(project, buildPath)
      if (compileError) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(
            `${logPrefix} Logic Board compile failed — saved blank main script:\n${compileError}`,
            'error',
          ),
        })
        dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
      }
      await saveScript(resolveScriptPath(buildPath, project.mainScriptPath), lua, buildPath)
      dispatch({
        type: 'UPSERT_SCRIPT',
        path: project.mainScriptPath,
        content: lua,
        isDirty: false,
        activate: false,
      })
      if (!compileError) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(`${logPrefix} Logic Board compiled -> ${project.mainScriptPath}`, 'info'),
        })
      }
    }
    await saveProjectFile(buildPath, project)
    dispatch({ type: 'MARK_PROJECT_SAVED' })
  } catch (err) {
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`${logPrefix} Prepare project failed: ${err}`, 'error'),
    })
    return null
  }

  return buildPath
}
