// ---------------------------------------------------------------------------
// api.ts — Phase 19: Real Tauri IPC calls
//
// All functions check isTauri() before calling native APIs so the editor
// continues to work in plain-browser mode (npm run dev without Tauri).
// ---------------------------------------------------------------------------

import { isTauri, invoke }                    from '@tauri-apps/api/core'
import { open  as dialogOpen,
         save  as dialogSave }                 from '@tauri-apps/plugin-dialog'
import { readTextFile, readFile, writeFile, mkdir, readDir, exists } from '@tauri-apps/plugin-fs'
import type { ProjectDoc }                     from '../types'
import { dirName, parseProjectDoc, safeProjectFolderName, serializeProjectDoc } from './project'
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

export interface LoadedProjectFile {
  project: ProjectDoc
  path: string
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

/**
 * Load either a source `project.json` or an exported `.artcade` package.
 *
 * `.artcade` files are ZIP archives, so opening one is treated as an import:
 * the package is extracted into a fresh folder next to the archive and that
 * folder's `project.json` becomes the active editable project path.
 */
export async function loadProjectFromPath(path: string): Promise<LoadedProjectFile | null> {
  if (isArtcadePackagePath(path)) {
    return importArtcadePackage(path)
  }
  const project = await loadProjectFile(path)
  return project ? { project, path } : null
}

function isArtcadePackagePath(path: string): boolean {
  return path.toLowerCase().endsWith('.artcade')
}

async function importArtcadePackage(packagePath: string): Promise<LoadedProjectFile | null> {
  if (!isTauri()) { notAvailable('importArtcadePackage'); return null }

  try {
    const bytes = await readFile(packagePath)
    const entries = parseZipEntries(bytes)
    const projectEntry = entries.find((entry) => entry.path === 'project.json')
    if (!projectEntry) {
      throw new Error('project.json not found inside package')
    }

    const projectJson = textDecoder.decode(await inflateZipEntry(bytes, projectEntry))
    const project = parseProjectDoc(projectJson)
    if (!project) {
      throw new Error('project.json inside package is invalid')
    }

    const importRoot = await uniqueImportRoot(packagePath, project.projectName)
    for (const entry of entries) {
      const relPath = safeArchivePath(entry.path)
      if (!relPath) continue
      const outputPath = joinPath(importRoot, relPath)
      await mkdir(dirName(outputPath), { recursive: true })
      await writeFile(outputPath, await inflateZipEntry(bytes, entry))
    }

    return { project, path: joinPath(importRoot, 'project.json') }
  } catch (err) {
    console.error('[api] importArtcadePackage failed:', err)
    return null
  }
}

interface ZipEntry {
  path: string
  method: number
  compressedSize: number
  localHeaderOffset: number
}

const ZIP_EOCD = 0x06054b50
const ZIP_CENTRAL_FILE = 0x02014b50
const ZIP_LOCAL_FILE = 0x04034b50
const textDecoder = new TextDecoder('utf-8')

function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minEocd = 22
  const maxComment = 0xffff
  const searchStart = Math.max(0, bytes.length - minEocd - maxComment)
  let eocd = -1

  for (let i = bytes.length - minEocd; i >= searchStart; i--) {
    if (view.getUint32(i, true) === ZIP_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('invalid ZIP: end of central directory not found')

  const entryCount = view.getUint16(eocd + 10, true)
  const centralOffset = view.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  let offset = centralOffset

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_FILE) {
      throw new Error('invalid ZIP: malformed central directory')
    }

    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nameStart = offset + 46
    const path = textDecoder.decode(bytes.subarray(nameStart, nameStart + nameLen))

    entries.push({ path: path.replace(/\\/g, '/'), method, compressedSize, localHeaderOffset })
    offset = nameStart + nameLen + extraLen + commentLen
  }

  return entries
}

async function inflateZipEntry(zipBytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength)
  const offset = entry.localHeaderOffset
  if (view.getUint32(offset, true) !== ZIP_LOCAL_FILE) {
    throw new Error(`invalid ZIP: malformed local header for ${entry.path}`)
  }

  const nameLen = view.getUint16(offset + 26, true)
  const extraLen = view.getUint16(offset + 28, true)
  const dataStart = offset + 30 + nameLen + extraLen
  const compressed = zipBytes.subarray(dataStart, dataStart + entry.compressedSize)

  if (entry.method === 0) return compressed
  if (entry.method !== 8) {
    throw new Error(`unsupported ZIP compression method ${entry.method} for ${entry.path}`)
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('this WebView cannot decompress .artcade packages')
  }

  const compressedCopy = new ArrayBuffer(compressed.byteLength)
  new Uint8Array(compressedCopy).set(compressed)
  const stream = new Blob([compressedCopy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function safeArchivePath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.endsWith('/')) return null
  if (/^[a-zA-Z]:\//.test(normalized)) return null
  if (normalized.split('/').some((part) => part === '..' || part === '')) return null
  return normalized
}

async function uniqueImportRoot(packagePath: string, projectName: string): Promise<string> {
  const baseDir = dirName(packagePath)
  const packageName = baseName(packagePath).replace(/\.artcade$/i, '')
  const safeName = safeProjectFolderName(projectName || packageName, packageName || 'Imported')
  const base = joinPath(baseDir, `${safeName}_imported`)
  if (!(await exists(base))) return base

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`
    if (!(await exists(candidate))) return candidate
  }
  throw new Error(`could not find an available import folder for ${packagePath}`)
}

function baseName(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(idx + 1) : filePath
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

import type { DependencyReport } from './dependencies'

export async function checkDependencies(): Promise<DependencyReport | null> {
  if (!isTauri()) { notAvailable('checkDependencies'); return null }
  return invoke<DependencyReport>('check_dependencies_cmd')
}

/** Download/extract ArtCade SDK to %LOCALAPPDATA%/ArtCade/sdk. */
export async function installSdk(includeEmscripten = false): Promise<void> {
  if (!isTauri()) { notAvailable('installSdk'); return }
  await invoke<void>('install_sdk', { includeEmscripten })
}

/**
 * Ensure SDK/tooling is present; optionally prompt and install on demand.
 * Returns true when the requested mode is ready to run.
 */
export async function ensureDependencies(
  mode: 'pack' | 'native' | 'wasm',
): Promise<boolean> {
  const report = await checkDependencies()
  if (!report) return false

  const ready =
    mode === 'pack' ? report.ready_for_pack
    : mode === 'native' ? report.ready_for_native_build
    : report.ready_for_wasm_build

  if (ready) return true

  const { missingDependencyLabels, formatDependencyReport } = await import('./dependencies')
  const missing = missingDependencyLabels(report, mode)
  const needsSdk =
    !report.runtime_sdk.ok ||
    !report.python.ok ||
    !report.cmake.ok ||
    !report.ninja.ok ||
    (mode === 'wasm' && !report.emscripten.ok)

  let message =
    `Missing: ${missing.join(', ')}\n\n${formatDependencyReport(report)}\n\n`

  if (needsSdk && report.runtime_sdk.can_install) {
    const includeEms = mode === 'wasm' && !report.emscripten.ok
    message += includeEms
      ? 'Install ArtCade SDK now? (includes Emscripten — large download)\n'
      : 'Install ArtCade SDK now? (downloads runtime sources, CMake, Ninja, Python)\n'
    if (!report.msvc.ok && mode === 'native') {
      message += '\nNote: Visual Studio Build Tools must still be installed separately.'
    }
    if (!window.confirm(message)) return false
    await installSdk(includeEms)
    const after = await checkDependencies()
    if (!after) return false
    return mode === 'pack' ? after.ready_for_pack
      : mode === 'native' ? after.ready_for_native_build
      : after.ready_for_wasm_build
  }

  if (!report.msvc.ok && mode === 'native') {
    message += '\nInstall Visual Studio Build Tools with "Desktop development with C++":\nhttps://visualstudio.microsoft.com/visual-cpp-build-tools/'
  }

  window.alert(message)
  return false
}

/**
 * Native compile + pack via on-demand SDK or dev checkout.
 * Streams stdout/stderr as "build-log" Tauri events.
 */
export async function runBuild(projectRoot: string): Promise<void> {
  if (!isTauri()) { notAvailable('runBuild'); return }

  await invoke<void>('run_build', { projectRoot })
}

export async function runBuildWasm(projectRoot: string): Promise<void> {
  if (!isTauri()) { notAvailable('runBuildWasm'); return }
  await invoke<void>('run_build_wasm', { projectRoot })
}

export type WebExportState = 'missing' | 'stale' | 'ready'

export interface WebExportStatus {
  state: WebExportState
  distDir: string
  hint: string
}

/** Missing / stale / ready — aligned with `dist/<name>-web/` on disk. */
export async function getWebExportStatus(
  projectRoot: string,
  projectDirty: boolean,
): Promise<WebExportStatus> {
  if (!isTauri()) {
    notAvailable('getWebExportStatus')
    return {
      state: 'missing',
      distDir: '',
      hint: 'Run BUILD WEB first to create a browser export',
    }
  }
  return invoke<WebExportStatus>('get_web_export_status', { projectRoot, projectDirty })
}

/** Serve `dist/<name>-web/` via localhost and open index.html in the default browser. */
export async function openWebExportInBrowser(projectRoot: string): Promise<string> {
  if (!isTauri()) { notAvailable('openWebExportInBrowser'); return '' }
  return invoke<string>('open_web_export_in_browser', { projectRoot })
}

/**
 * Run pack-artcade.py. Streams stdout as "build-log" events.
 */
export async function packProject(projectRoot: string, outputPath: string): Promise<void> {
  if (!isTauri()) { notAvailable('packProject'); return }

  await invoke<void>('pack_project', { projectRoot, outputPath })
}
