import { isTauri, invoke } from '@tauri-apps/api/core'
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'
import { readTextFile, readFile, writeFile, mkdir, readDir, exists } from '@tauri-apps/plugin-fs'
import type { ProjectDoc } from '../types'
import { dirName, parseProjectDoc, safeProjectFolderName, serializeProjectDoc } from './project'
import { validateProjectBeforeSave } from './logic-board/validate-project'
import { importArtcadePackage, isArtcadePackagePath, type LoadedProjectFile } from './artcade-package'
import { joinPath } from './file-paths'
import { assertProjectPathsSafe, normalizeProjectRelativePath } from './project-path-security'

function notAvailable(name: string): void {
  console.warn(`[api] ${name}: Tauri not available in browser mode`)
}

/**
 * Open a native file-picker filtered for source projects and packages.
 * Returns the chosen absolute path, or null if cancelled.
 */
export async function openProjectDialog(): Promise<string | null> {
  if (!isTauri()) { notAvailable('openProjectDialog'); return null }

  const selected = await dialogOpen({
    title:    'Open ArtCade Project',
    multiple: false,
    filters:  [
      { name: 'ArtCade Project', extensions: ['json', 'artcade'] },
      { name: 'Project Source', extensions: ['json'] },
      { name: 'ArtCade Package', extensions: ['artcade'] },
    ],
  })
  return typeof selected === 'string' ? selected : null
}

/**
 * Read and parse a project.json from disk.
 * Returns a normalised ProjectDoc (Vec2/Vec4 arrays → objects) or null on error.
 */
export async function loadProjectFile(path: string): Promise<ProjectDoc | null> {
  if (!isTauri()) { notAvailable('loadProjectFile'); return null }

  try {
    const content = await readTextFile(path)
    const project = parseProjectDoc(content)
    if (project) assertProjectPathsSafe(project)
    return project
  } catch (err) {
    console.error('[api] loadProjectFile failed:', err)
    return null
  }
}

/** Load either a source `project.json` or an exported `.artcade` package. */
export async function loadProjectFromPath(path: string): Promise<LoadedProjectFile | null> {
  if (isArtcadePackagePath(path)) {
    return importArtcadePackage(path)
  }
  const project = await loadProjectFile(path)
  return project ? { project, path } : null
}

/**
 * Read script content from disk. Used by Inspector → "Open in Script Editor"
 * so the tab is populated with the real file rather than an empty buffer
 * that the next Save would write over the user's code.
 */
export async function loadScript(path: string): Promise<string | null> {
  if (!isTauri()) { notAvailable('loadScript'); return null }
  try {
    return await readTextFile(path)
  } catch (err) {
    console.error('[api] loadScript failed:', err)
    return null
  }
}

/**
 * Write script content to disk via the custom Rust `write_file` command.
 * Creates parent directories automatically.
 */
export async function saveScript(path: string, content: string): Promise<void> {
  if (!isTauri()) { notAvailable('saveScript'); return }

  await invoke('write_file', { path, content })
}

export function resolveScriptPath(projectPath: string | null, scriptPath: string): string {
  const safeScriptPath = normalizeProjectRelativePath(scriptPath, 'scriptPath')
  if (!projectPath) {
    throw new Error(
      `Cannot resolve "${scriptPath}": project has no on-disk location yet ` +
      `(use Save Project As… first).`,
    )
  }
  const root = projectPath.replace(/[\\/][^\\/]+$/, '').replace(/\\/g, '/')
  return `${root}/${safeScriptPath}`
}

export async function saveProjectFile(path: string, project: ProjectDoc): Promise<void> {
  if (!isTauri()) { notAvailable('saveProjectFile'); return }

  validateProjectBeforeSave(project)

  await invoke('write_file', { path, content: serializeProjectDoc(project) })
}

/**
 * Open a native directory picker for the parent folder that will contain the
 * project folder.
 *
 * @returns the chosen parent folder, or null if the dialog was cancelled.
 */
export async function saveProjectAsDialog(
  projectName = 'Untitled',
  options?: { defaultPath?: string },
): Promise<string | null> {
  if (!isTauri()) { notAvailable('saveProjectAsDialog'); return null }

  const folderName = safeProjectFolderName(projectName, 'Untitled')
  const selected = await dialogOpen({
    title:       `Select parent folder for project "${folderName}"`,
    directory:   true,
    multiple:    false,
    defaultPath: options?.defaultPath,
  })
  return typeof selected === 'string' ? selected : null
}

/** Copy `assets/` and `scripts/` from an existing project root into a new root. */
export async function copyProjectDataDirs(fromRoot: string, toRoot: string): Promise<void> {
  if (!isTauri()) { notAvailable('copyProjectDataDirs'); return }

  for (const dirName of ['assets', 'scripts'] as const) {
    await copyDirRecursive(joinPath(fromRoot, dirName), joinPath(toRoot, dirName))
  }
}

async function copyDirRecursive(src: string, dst: string): Promise<void> {
  if (!(await exists(src))) return
  await mkdir(dst, { recursive: true })
  const entries = await readDir(src)
  for (const entry of entries) {
    const srcPath = joinPath(src, entry.name)
    const dstPath = joinPath(dst, entry.name)
    if (entry.isDirectory) {
      await copyDirRecursive(srcPath, dstPath)
    } else if (entry.isFile) {
      await mkdir(dirName(dstPath), { recursive: true })
      await writeFile(dstPath, await readFile(srcPath))
    }
  }
}

/**
 * Scaffold a brand-new project on disk: creates `<parent>/<projectName>/`,
 * writes project.json inside it, and writes a starter script at
 * `<projectDir>/<mainScriptPath>`. Parent directories are created on demand
 * (write_file does `mkdir -p` internally).
 *
 * Returns the absolute path of the saved project.json so the caller can
 * update editor state (projectPath + MARK_PROJECT_SAVED) atomically.
 *
 * @param parentDir        Directory selected by the user; project folder is
 *                         created inside it.
 * @param project          ProjectDoc to serialise.
 * @param mainScriptBody   Initial content for project.mainScriptPath.
 */
export async function scaffoldNewProjectOnDisk(
  parentDir: string,
  project: ProjectDoc,
  mainScriptBody: string,
): Promise<string> {
  const projectRoot = joinPath(parentDir, safeProjectFolderName(project.projectName, 'Untitled'))
  const projectJsonPath = joinPath(projectRoot, 'project.json')

  if (!isTauri()) {
    notAvailable('scaffoldNewProjectOnDisk')
    return projectJsonPath
  }

  validateProjectBeforeSave(project)

  await invoke('write_file', {
    path:    projectJsonPath,
    content: serializeProjectDoc(project),
  })

  const mainScriptPath = normalizeProjectRelativePath(project.mainScriptPath, 'mainScriptPath')
  const scriptPath  = `${projectRoot}/${mainScriptPath}`.replace(/\\/g, '/')

  await invoke('write_file', {
    path:    scriptPath,
    content: mainScriptBody,
  })

  return projectJsonPath
}

export type { LoadedProjectFile }
