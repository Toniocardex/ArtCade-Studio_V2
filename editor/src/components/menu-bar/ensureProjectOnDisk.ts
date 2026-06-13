import type { Dispatch } from 'react'
import type { Action as EditorAction } from '../../store/editor-store'
import {
  copyProjectDataDirs,
  resolveScriptPath,
  saveProjectAsDialog,
  saveProjectFile,
  saveScript,
  scaffoldNewProjectOnDisk,
} from '../../utils/api'
import {
  dirName,
  projectFolderBaseName,
  projectRootFromProjectPath,
  safeProjectFolderName,
} from '../../utils/project'
import type { ProjectDoc, ScriptFile } from '../../types'
import { saveDialogsToProject, starterInnkeeperScript } from '../../utils/dialog/dialog-file-api'
import type { DialogScript } from '../../utils/dialog/dialog-script'
import { confirmDialog } from '../../utils/native-dialog'
import { resolveManualMainLua } from '../../utils/project-main-script'
import { makeConsoleEntry } from './makeConsoleEntry'

export type PersistKind = 'Build' | 'WASM' | 'Web' | 'save'

interface EnsureProjectOnDiskOptions {
  kind: PersistKind
  dispatch: Dispatch<EditorAction>
  project: ProjectDoc
  projectPath: string | null
  dialogs: Record<string, DialogScript>
  openScripts?: ScriptFile[]
}

function buildConfirmMessage(kind: PersistKind): string {
  return kind === 'save'
    ? 'The project has not been saved.\nChoose a parent folder now?'
    : 'The project has not been saved.\nSave it now before building?'
}

async function scaffoldIntoParent(
  parentDir: string,
  project: ProjectDoc,
  dialogs: Record<string, DialogScript>,
  dispatch: Dispatch<EditorAction>,
  logPrefix: string,
  manualLua: string,
): Promise<string | null> {
  try {
    const projectJsonPath = await scaffoldNewProjectOnDisk(parentDir, project, manualLua)
    const library = Object.keys(dialogs).length > 0
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
    dispatch({ type: 'LOG', entry: makeConsoleEntry(`${logPrefix} Save failed: ${err}`, 'error') })
    return null
  }
}

async function migrateProjectFolder(
  opts: EnsureProjectOnDiskOptions,
  folderName: string,
  manualLua: string,
): Promise<string | null> {
  const { dispatch, project, projectPath } = opts
  if (!projectPath) return null

  const oldRoot = projectRootFromProjectPath(projectPath)
  const oldFolder = projectFolderBaseName(projectPath)
  const ok = await confirmDialog(
    `Project is named "${folderName}" but saved in folder "${oldFolder}".\n` +
      `Save a copy into a new "${folderName}" folder?`,
    { title: 'Project folder name', kind: 'warning' },
  )
  if (!ok) return null

  const parentDir = await saveProjectAsDialog(folderName, { defaultPath: dirName(oldRoot) })
  if (!parentDir) return null
  const projectJsonPath = await scaffoldIntoParent(
    parentDir,
    project,
    opts.dialogs,
    dispatch,
    '[File]',
    manualLua,
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
  const { kind, dispatch, project, projectPath, dialogs, openScripts = [] } = opts
  const folderName = safeProjectFolderName(project.projectName, 'Untitled')
  const logPrefix = kind === 'save' ? '[File]' : `[${kind}]`
  const manualLua = resolveManualMainLua(project, openScripts)
  let buildPath = projectPath ?? ''

  if (!buildPath) {
    const ok = await confirmDialog(buildConfirmMessage(kind), {
      title: 'Save project',
      kind: 'warning',
    })
    if (!ok) return null
    const parentDir = await saveProjectAsDialog(folderName)
    if (!parentDir) return null
    buildPath = await scaffoldIntoParent(
      parentDir,
      project,
      dialogs,
      dispatch,
      logPrefix,
      manualLua,
    ) ?? ''
    if (!buildPath) return null
  } else if (projectFolderBaseName(buildPath) !== folderName) {
    const migrated = await migrateProjectFolder(opts, folderName, manualLua)
    if (!migrated) return null
    buildPath = migrated
  }

  try {
    await saveDialogsToProject(buildPath, dialogs)
    if (kind === 'save' && project.mainScriptPath) {
      await saveScript(resolveScriptPath(buildPath, project.mainScriptPath), manualLua, buildPath)
      dispatch({ type: 'MARK_SCRIPT_SAVED', path: project.mainScriptPath })
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
