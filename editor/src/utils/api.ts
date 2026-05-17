// ---------------------------------------------------------------------------
// api.ts — Phase 19: Real Tauri IPC calls
//
// All functions check isTauri() before calling native APIs so the editor
// continues to work in plain-browser mode (npm run dev without Tauri).
// ---------------------------------------------------------------------------

import { isTauri, invoke }                    from '@tauri-apps/api/core'
import { open  as dialogOpen,
         save  as dialogSave }                 from '@tauri-apps/plugin-dialog'
import { readTextFile }                        from '@tauri-apps/plugin-fs'
import type { ProjectDoc }                     from '../types'
import { parseProjectDoc, serializeProjectDoc } from './project'

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
// Script saving
// ---------------------------------------------------------------------------

/**
 * Write script content to disk via the custom Rust `write_file` command.
 * Creates parent directories automatically.
 */
export async function saveScript(path: string, content: string): Promise<void> {
  if (!isTauri()) { notAvailable('saveScript'); return }

  await invoke('write_file', { path, content })
}

export async function saveProjectFile(path: string, project: ProjectDoc): Promise<void> {
  if (!isTauri()) { notAvailable('saveProjectFile'); return }

  await invoke('write_file', { path, content: serializeProjectDoc(project) })
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
