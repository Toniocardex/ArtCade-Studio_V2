import { isTauri, invoke } from '@tauri-apps/api/core'
import { save as dialogSave } from '@tauri-apps/plugin-dialog'
import type { DependencyReport } from './dependencies'

function notAvailable(name: string): void {
  console.warn(`[api] ${name}: Tauri not available in browser mode`)
}

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
