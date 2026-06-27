import { isTauri } from '@tauri-apps/api/core'
import { invokeTauri } from './tauri-invoke'
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'
import { readTextFile, readFile, writeFile, mkdir, readDir, exists } from '@tauri-apps/plugin-fs'
import type { ProjectDoc } from '../types'
import {
  dirName,
  parseProjectDoc,
  parseProjectDocWithMeta,
  safeProjectFolderName,
  serializeProjectDoc,
  unsupportedProjectFormatMessage,
} from './project'
import { validateProjectBeforeSave } from './logic-board/validate-project'
import { importArtcadePackage, isArtcadePackagePath, type LoadedProjectFile } from './artcade-package'
import { joinPath } from './file-paths'
import { projectRootFromProjectPath } from './project-paths'
import { assertProjectPathsSafe, normalizeProjectRelativePath } from './project-path-security'
import { registerProjectFsScope } from './project-fs-scope'
import { commitPendingAssets, flushPendingAssets } from './pending-asset-store'
import { referencedAssetPaths } from './referenced-asset-paths'

/** Decode a `data:...;base64,<payload>` URL into raw bytes (null if malformed). */
function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  try {
    const comma = dataUrl.indexOf(',')
    if (comma < 0 || !/;base64/i.test(dataUrl.slice(0, comma))) return null
    const bin = atob(dataUrl.slice(comma + 1))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

/** True when a project-relative asset file already exists on disk. */
async function assetFileExists(projectRoot: string, relPath: string): Promise<boolean> {
  try {
    return await exists(joinPath(projectRoot, relPath))
  } catch {
    // Path outside the registered fs scope (e.g. a brand-new scaffold root): we
    // can't verify, so don't block the save on it — pending/dataUrl already
    // cover freshly-imported assets in that situation.
    return true
  }
}

async function missingReferencedAssetPaths(
  projectRoot: string,
  project: ProjectDoc,
): Promise<string[]> {
  const missing: string[] = []
  for (const path of [...referencedAssetPaths(project)].sort()) {
    if (!(await assetFileExists(projectRoot, path))) missing.push(path)
  }
  return missing
}

function formatMissingAssetOpenWarning(paths: readonly string[]): string {
  const shown = paths.slice(0, 8).map((path) => `- ${path}`)
  const remaining = paths.length - shown.length
  return [
    `Project opened with ${paths.length} missing asset file${paths.length === 1 ? '' : 's'}.`,
    '',
    ...shown,
    ...(remaining > 0 ? [`- ...and ${remaining} more`] : []),
    '',
    'Re-import the missing assets or remove their references before saving/exporting.',
  ].join('\n')
}

/**
 * Make every asset file the project references durable before project.json is
 * committed, and fail loudly if any cannot be — so we never write a project.json
 * that points at files which do not exist (the lost-texture bug).
 *
 * Three sources, in priority order:
 *   1. Staged bytes from this session's imports (the pending store).
 *   2. An image's in-memory `dataUrl` (kept until the project is reloaded).
 *   3. A file already on disk from a previous save.
 *
 * @returns the pending paths flushed (for the caller to commit).
 * @throws if a referenced asset has no recoverable bytes and is not on disk.
 */
async function persistReferencedAssets(
  projectRoot: string,
  project: ProjectDoc,
): Promise<string[]> {
  const referenced = referencedAssetPaths(project)
  const flushed = await flushPendingAssets(({ path, bytes }) =>
    invokeWriteBinaryFile(joinPath(projectRoot, path), bytes, projectRoot),
    (path) => referenced.has(path),
  )

  // Track which referenced paths are now guaranteed on disk this save.
  const persisted = new Set(flushed.filter((path) => referenced.has(path)))

  // Recover freshly-imported images whose staged bytes were dropped (e.g. by a
  // project reload between import and save) from their in-memory dataUrl.
  for (const asset of Object.values(project.assets ?? {})) {
    if (!asset.dataUrl || persisted.has(asset.path)) continue
    const bytes = dataUrlToBytes(asset.dataUrl)
    if (!bytes) continue
    await invokeWriteBinaryFile(joinPath(projectRoot, asset.path), bytes, projectRoot)
    persisted.add(asset.path)
  }

  // Integrity gate: anything still unaccounted for must already be on disk,
  // otherwise the save would dangle. Surface it instead of corrupting silently.
  const missing: string[] = []
  for (const path of referenced) {
    if (persisted.has(path)) continue
    if (!(await assetFileExists(projectRoot, path))) missing.push(path)
  }
  if (missing.length > 0) {
    throw new Error(
      `Cannot save: ${missing.length} referenced asset file(s) are missing and ` +
        `cannot be recovered (re-import the affected asset, then save again):\n` +
        missing.map((p) => `  • ${p}`).join('\n'),
    )
  }

  return flushed
}

/** Validated project write via Tauri `write_file` (requires project root). */
export async function invokeWriteFile(
  path: string,
  content: string,
  projectRoot: string,
): Promise<void> {
  await invokeTauri<void>('write_file', { path, content, projectRoot })
}

/** Validated binary write (e.g. assets/images) via Rust path sandbox. */
export async function invokeWriteBinaryFile(
  path: string,
  bytes: Uint8Array,
  projectRoot: string,
): Promise<void> {
  await invokeTauri<void>('write_binary_file', { path, bytes: Array.from(bytes), projectRoot })
}

/** Validated project file deletion via Tauri path sandbox. */
export async function invokeDeleteProjectFile(
  path: string,
  projectRoot: string,
): Promise<void> {
  await invokeTauri<void>('delete_project_file', { path, projectRoot })
}

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
    await registerProjectFsScope(path)
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
  if (isTauri()) await registerProjectFsScope(path)
  if (isArtcadePackagePath(path)) {
    return importArtcadePackage(path)
  }
  if (!isTauri()) { notAvailable('loadProjectFromPath'); return null }
  try {
    const content = await readTextFile(path)
    const unsupportedFormat = unsupportedProjectFormatMessage(content)
    if (unsupportedFormat) throw new Error(unsupportedFormat)
    const parsed = parseProjectDocWithMeta(content)
    if (!parsed) return null
    const { project, logicBoardLoadIssues } = parsed
    assertProjectPathsSafe(project)
    const missingAssets = await missingReferencedAssetPaths(projectRootFromProjectPath(path), project)
    return {
      project,
      path,
      ...(logicBoardLoadIssues.length > 0 ? { logicBoardLoadIssues } : {}),
      ...(missingAssets.length > 0
        ? { openWarnings: [formatMissingAssetOpenWarning(missingAssets)] }
        : {}),
    }
  } catch (err) {
    console.error('[api] loadProjectFromPath failed:', err)
    throw err
  }
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
export async function saveScript(
  path: string,
  content: string,
  projectJsonPath: string,
): Promise<void> {
  if (!isTauri()) { notAvailable('saveScript'); return }

  const projectRoot = projectRootFromProjectPath(projectJsonPath)
  await invokeWriteFile(path, content, projectRoot)
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

  const projectRoot = projectRootFromProjectPath(path)
  const pendingPaths = await persistReferencedAssets(projectRoot, project)
  await invokeWriteFile(path, serializeProjectDoc(project), projectRoot)
  commitPendingAssets(pendingPaths)
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
 * writes a starter script and commits project.json last at
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

  const pendingPaths = await persistReferencedAssets(projectRoot, project)

  const mainScriptPath = normalizeProjectRelativePath(project.mainScriptPath, 'mainScriptPath')
  const scriptPath  = `${projectRoot}/${mainScriptPath}`.replace(/\\/g, '/')

  await invokeWriteFile(scriptPath, mainScriptBody, projectRoot)
  await invokeWriteFile(
    projectJsonPath,
    serializeProjectDoc(project),
    projectRoot,
  )
  commitPendingAssets(pendingPaths)
  await registerProjectFsScope(projectJsonPath)

  return projectJsonPath
}

export type { LoadedProjectFile }
