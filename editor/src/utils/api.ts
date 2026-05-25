// ---------------------------------------------------------------------------
// api.ts — Phase 19: Real Tauri IPC calls
//
// All functions check isTauri() before calling native APIs so the editor
// continues to work in plain-browser mode (npm run dev without Tauri).
// ---------------------------------------------------------------------------

import { isTauri, invoke }                    from '@tauri-apps/api/core'
import { open  as dialogOpen,
         save  as dialogSave }                 from '@tauri-apps/plugin-dialog'
import { readTextFile, readFile, writeFile, mkdir } from '@tauri-apps/plugin-fs'
import type { ProjectDoc }                     from '../types'
import { parseProjectDoc, serializeProjectDoc } from './project'
import { validateProjectBeforeSave } from './logic-board/validate-project'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notAvailable(name: string): void {
  console.warn(`[api] ${name}: Tauri not available in browser mode`)
}

// ---------------------------------------------------------------------------
// Project file I/O
// ---------------------------------------------------------------------------

/**
 * Open a native file-picker filtered for .json (project.json).
 * Returns the chosen absolute path, or null if cancelled.
 */
export async function openProjectDialog(): Promise<string | null> {
  if (!isTauri()) { notAvailable('openProjectDialog'); return null }

  const selected = await dialogOpen({
    title:    'Open ArtCade Project',
    multiple: false,
    filters:  [{ name: 'ArtCade Project', extensions: ['json'] }],
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
    return parseProjectDoc(content)
  } catch (err) {
    console.error('[api] loadProjectFile failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Tileset image I/O (Phase F)
// ---------------------------------------------------------------------------

/** Native file-picker for a spritesheet image. Returns the path or null. */
export async function openImageDialog(): Promise<string | null> {
  if (!isTauri()) { notAvailable('openImageDialog'); return null }

  const selected = await dialogOpen({
    title:    'Open Tileset Image',
    multiple: false,
    filters:  [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
  })
  return typeof selected === 'string' ? selected : null
}

/** Read an image from disk and return a base64 data URL for React preview. */
export async function readImageAsDataUrl(path: string): Promise<string | null> {
  if (!isTauri()) { notAvailable('readImageAsDataUrl'); return null }

  try {
    const bytes = await readFile(path)
    const ext = path.toLowerCase().split('.').pop() ?? 'png'
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : 'image/png'
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return `data:${mime};base64,${btoa(bin)}`
  } catch (err) {
    console.error('[api] readImageAsDataUrl failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Persistent image asset library
// ---------------------------------------------------------------------------

/** Forward-slash join (Tauri normalises separators per-OS). */
function joinPath(...parts: string[]): string {
  return parts.map(p => p.replace(/[\\/]+$/, '')).join('/')
}

/**
 * Copy an imported image into the project's `assets/images/` folder so it
 * survives reopen / .artcade. Returns the path RELATIVE to the project root
 * (also the key the runtime renders with), or null in browser mode.
 */
export async function importImageIntoProject(
  projectRoot: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<string | null> {
  if (!isTauri()) { notAvailable('importImageIntoProject'); return null }
  const relDir  = 'assets/images'
  const relPath = `${relDir}/${fileName}`
  try {
    await mkdir(joinPath(projectRoot, relDir), { recursive: true })
    await writeFile(joinPath(projectRoot, relPath), bytes)
    return relPath
  } catch (err) {
    console.error('[api] importImageIntoProject failed:', err)
    return null
  }
}

/** Read a project image (path relative to project root) as raw bytes. */
export async function readProjectImageBytes(
  projectRoot: string,
  relPath: string,
): Promise<Uint8Array | null> {
  if (!isTauri()) { notAvailable('readProjectImageBytes'); return null }
  try {
    return await readFile(joinPath(projectRoot, relPath))
  } catch (err) {
    console.error('[api] readProjectImageBytes failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Script saving
// ---------------------------------------------------------------------------

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

/**
 * Resolve a script path stored in the editor (typically relative to the
 * project root, e.g. "scripts/main.lua") to an absolute filesystem path
 * usable by saveScript / loadScript. Absolute paths are returned unchanged.
 *
 * Throws if `projectPath` is empty and `scriptPath` is not absolute — that
 * case means the project was never saved to disk, and there is nowhere to
 * resolve against.
 */
export function resolveScriptPath(projectPath: string | null, scriptPath: string): string {
  const isAbs = /^([a-zA-Z]:[\\/]|[\\/])/.test(scriptPath)
  if (isAbs) return scriptPath.replace(/\\/g, '/')
  if (!projectPath) {
    throw new Error(
      `Cannot resolve "${scriptPath}": project has no on-disk location yet ` +
      `(use Save Project As… first).`,
    )
  }
  const root = projectPath.replace(/[\\/][^\\/]+$/, '').replace(/\\/g, '/')
  return `${root}/${scriptPath}`.replace(/\\/g, '/')
}

export async function saveProjectFile(path: string, project: ProjectDoc): Promise<void> {
  if (!isTauri()) { notAvailable('saveProjectFile'); return }

  validateProjectBeforeSave(project)

  await invoke('write_file', { path, content: serializeProjectDoc(project) })
}

/**
 * Open a native "Save As" dialog filtered for project.json.
 *
 * The dialog defaults to the file name "project.json"; the user may pick any
 * directory. We do NOT force the filename so the user can also save next to
 * a renamed copy, but we always ensure a `.json` extension on the result.
 *
 * @returns the chosen absolute path, or null if the dialog was cancelled.
 */
export async function saveProjectAsDialog(): Promise<string | null> {
  if (!isTauri()) { notAvailable('saveProjectAsDialog'); return null }

  const chosen = await dialogSave({
    title:       'Save ArtCade Project As',
    defaultPath: 'project.json',
    filters:     [{ name: 'ArtCade Project', extensions: ['json'] }],
  })
  if (!chosen) return null
  return /\.json$/i.test(chosen) ? chosen : `${chosen}.json`
}

/**
 * Scaffold a brand-new project on disk: writes both project.json and a
 * starter script at `<projectDir>/<mainScriptPath>`. Parent directories
 * are created on demand (write_file does `mkdir -p` internally).
 *
 * Returns the absolute path of the saved project.json so the caller can
 * update editor state (projectPath + MARK_PROJECT_SAVED) atomically.
 *
 * @param projectJsonPath  Target project.json absolute path.
 * @param project          ProjectDoc to serialise.
 * @param mainScriptBody   Initial content for project.mainScriptPath.
 */
export async function scaffoldNewProjectOnDisk(
  projectJsonPath: string,
  project: ProjectDoc,
  mainScriptBody: string,
): Promise<string> {
  if (!isTauri()) {
    notAvailable('scaffoldNewProjectOnDisk')
    return projectJsonPath
  }

  validateProjectBeforeSave(project)

  await invoke('write_file', {
    path:    projectJsonPath,
    content: serializeProjectDoc(project),
  })

  const projectRoot = projectJsonPath.replace(/[/\\][^/\\]+$/, '')
  const scriptPath  = `${projectRoot}/${project.mainScriptPath}`.replace(/\\/g, '/')

  await invoke('write_file', {
    path:    scriptPath,
    content: mainScriptBody,
  })

  return projectJsonPath
}

// ---------------------------------------------------------------------------
// Pack dialog
// ---------------------------------------------------------------------------

/**
 * Open a Save-As dialog for the output .artcade file.
 * Returns the chosen path, or null if cancelled.
 */
export async function savePackDialog(): Promise<string | null> {
  if (!isTauri()) { notAvailable('savePackDialog'); return null }

  const path = await dialogSave({
    title:   'Save .artcade Package',
    filters: [{ name: 'ArtCade Package', extensions: ['artcade'] }],
  })
  return path ?? null
}

// ---------------------------------------------------------------------------
// Build pipeline
// ---------------------------------------------------------------------------

/**
 * Run `cmake --build <projectRoot>/runtime-cpp/build --config Release --parallel`.
 * Streams every stdout/stderr line as a "build-log" Tauri event to the frontend.
 */
export async function runBuild(projectRoot: string): Promise<void> {
  if (!isTauri()) { notAvailable('runBuild'); return }

  await invoke<void>('run_build', { projectRoot })
}

/**
 * Run `python tools/pack-artcade.py <projectRoot> <outputPath>`.
 * Streams stdout as "build-log" events.
 */
export async function packProject(projectRoot: string, outputPath: string): Promise<void> {
  if (!isTauri()) { notAvailable('packProject'); return }

  await invoke<void>('pack_project', { projectRoot, outputPath })
}
