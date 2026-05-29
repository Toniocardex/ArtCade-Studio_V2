// ---------------------------------------------------------------------------
// asset-orchestrator — scene-scoped WASM image upload (Phase A/B)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import { readProjectFileBytes } from './asset-file-api'
import { collectSceneAssetRefs, collectSceneAudioRefs } from './collect-scene-asset-refs'
import {
  editorRegisterAudio,
  editorRegisterFont,
  editorRegisterImage,
  isReady as isWasmReady,
} from './wasm-bridge'
import {
  imageAssetForPath,
  resolveImageLoadKey,
  resetResolveImageLoadKeyWarnings,
} from './resolve-image-load-key'
import type {
  AssetDescriptor,
  AssetLoadFailure,
  AssetLoadPriority,
  AssetLoadResult,
} from './asset-types'

export interface AssetOrchestratorDeps {
  readProjectFileBytes: (projectRoot: string, relPath: string) => Promise<Uint8Array | null>
  registerImage: (path: string, bytes: Uint8Array, ext: string) => boolean
  registerAudio: (path: string, bytes: Uint8Array, ext: string) => boolean
  registerFont: (path: string, bytes: Uint8Array, ext: string, baseSize: number) => boolean
  isRuntimeReady: () => boolean
  scheduleIdle: (fn: () => void) => void
  cancelIdle?: (fn: () => void) => void
  logFailure: (path: string, reason: string) => void
}

function extFromPath(path: string): string {
  const ext = `.${(path.split('.').pop() ?? 'png').toLowerCase()}`
  return ext.startsWith('.') ? ext : `.${ext}`
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  try {
    const b64 = dataUrl.split(',')[1] ?? ''
    const bin = atob(b64)
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    return u8
  } catch {
    return null
  }
}

const warnedMissingLibrary = new Set<string>()

function warnMissingFromLibraryOnce(path: string): void {
  if (warnedMissingLibrary.has(path)) return
  warnedMissingLibrary.add(path)
  console.warn(`[Asset] Scene references image not in library: ${path}`)
}

/** Map collected paths to load descriptors (§5.1.7). */
export function pathsToDescriptors(
  project: ProjectDoc,
  paths: readonly string[],
): AssetDescriptor[] {
  const out: AssetDescriptor[] = []
  const seen = new Set<string>()
  for (const raw of paths) {
    const path = resolveImageLoadKey(project, raw)
    if (!path || seen.has(path)) continue
    seen.add(path)
    const asset = imageAssetForPath(project, path)
    if (asset) {
      out.push({
        id: asset.id,
        type: 'image',
        path: asset.path,
        ext: extFromPath(asset.path),
        dataUrl: asset.dataUrl,
      })
    } else {
      warnMissingFromLibraryOnce(path)
      out.push({
        id: path,
        type: 'image',
        path,
        ext: extFromPath(path),
      })
    }
  }
  return out
}

/** Map audio paths to descriptors (library id when known). */
export function audioPathsToDescriptors(
  project: ProjectDoc,
  paths: readonly string[],
): AssetDescriptor[] {
  const out: AssetDescriptor[] = []
  const seen = new Set<string>()
  const byPath = new Map<string, string>()
  for (const [id, asset] of Object.entries(project.audioAssets ?? {})) {
    const p = asset.path?.trim()
    if (p) byPath.set(p, id)
  }
  for (const raw of paths) {
    const path = raw.trim()
    if (!path || seen.has(path)) continue
    seen.add(path)
    out.push({
      id: byPath.get(path) ?? path,
      type: 'audio',
      path,
      ext: extFromPath(path),
    })
  }
  return out
}

export function projectFontDescriptors(project: ProjectDoc): AssetDescriptor[] {
  const out: AssetDescriptor[] = []
  for (const asset of Object.values(project.fontAssets ?? {})) {
    const path = asset.path?.trim()
    if (!path) continue
    out.push({
      id: asset.id,
      type: 'font',
      path,
      ext: extFromPath(path),
    })
  }
  return out
}

export function sceneAssetDescriptors(
  project: ProjectDoc,
  sceneId: string,
): AssetDescriptor[] {
  const imagePaths = collectSceneAssetRefs(project, sceneId)
  const audioPaths = collectSceneAudioRefs(project, sceneId)
  return [
    ...pathsToDescriptors(project, imagePaths),
    ...audioPathsToDescriptors(project, audioPaths),
    ...projectFontDescriptors(project),
  ]
}

export function registerKeyForDescriptor(desc: AssetDescriptor): string {
  return `${desc.type}:${desc.path}#${desc.dataUrl ? 'd' : 'f'}`
}

export class AssetOrchestrator {
  loadGeneration = 0
  prefetchGeneration = 0
  private readonly inFlight = new Map<
    string,
    Promise<'loaded' | 'cancelled' | { reason: string }>
  >()
  private readonly registered = new Set<string>()
  private readonly loggedFailures = new Set<string>()

  constructor(private readonly deps: AssetOrchestratorDeps) {}

  clearRegistered(): void {
    this.registered.clear()
    this.inFlight.clear()
    this.loggedFailures.clear()
    warnedMissingLibrary.clear()
    resetResolveImageLoadKeyWarnings()
  }

  private logFailureOnce(path: string, reason: string): void {
    if (this.loggedFailures.has(path)) return
    this.loggedFailures.add(path)
    this.deps.logFailure(path, reason)
  }

  isRegistered(desc: AssetDescriptor): boolean {
    return this.registered.has(registerKeyForDescriptor(desc))
  }

  bumpSceneGeneration(): number {
    this.loadGeneration++
    this.cancelPrefetch()
    return this.loadGeneration
  }

  cancelPrefetch(): void {
    this.prefetchGeneration++
  }

  async loadScene(
    project: ProjectDoc,
    sceneId: string,
    projectRoot: string,
  ): Promise<AssetLoadResult> {
    const gen = this.bumpSceneGeneration()
    return this.loadDescriptors(
      project,
      sceneAssetDescriptors(project, sceneId),
      projectRoot,
      gen,
      'critical',
    )
  }

  prefetchScene(
    project: ProjectDoc,
    sceneId: string,
    projectRoot: string,
  ): void {
    const pfGen = ++this.prefetchGeneration
    const descriptors = sceneAssetDescriptors(project, sceneId)
    const run = () => {
      if (pfGen !== this.prefetchGeneration) return
      void this.loadDescriptors(project, descriptors, projectRoot, pfGen, 'prefetch')
    }
    this.deps.scheduleIdle(run)
  }

  async loadDescriptors(
    project: ProjectDoc,
    descriptors: AssetDescriptor[],
    projectRoot: string,
    generation: number,
    priority: AssetLoadPriority,
  ): Promise<AssetLoadResult> {
    if (!this.deps.isRuntimeReady()) {
      return { ok: false, loaded: [], failed: [] }
    }

    const loaded: string[] = []
    const failed: AssetLoadFailure[] = []
    let cancelled = false

    const sorted =
      priority === 'critical'
        ? descriptors
        : [...descriptors].sort((a, b) => a.path.localeCompare(b.path))

    for (const desc of sorted) {
      if (!this.isGenerationCurrent(generation, priority)) {
        cancelled = true
        break
      }
      const result = await this.loadOne(project, desc, projectRoot, generation, priority)
      if (result === 'cancelled') {
        cancelled = true
        break
      }
      if (result === 'loaded') loaded.push(desc.path)
      else if (result.reason) failed.push({ path: desc.path, reason: result.reason })
    }

    return {
      ok: failed.length === 0 && !cancelled,
      loaded,
      failed,
      ...(cancelled ? { cancelled: true } : {}),
    }
  }

  private isGenerationCurrent(generation: number, priority: AssetLoadPriority): boolean {
    if (priority === 'critical') return generation === this.loadGeneration
    return generation === this.prefetchGeneration
  }

  private async loadOne(
    project: ProjectDoc,
    desc: AssetDescriptor,
    projectRoot: string,
    generation: number,
    priority: AssetLoadPriority,
  ): Promise<'loaded' | 'cancelled' | { reason: string }> {
    const regKey = registerKeyForDescriptor(desc)
    if (this.registered.has(regKey)) return 'loaded'

    const inflightKey = `${priority}:${desc.path}`
    const existing = this.inFlight.get(inflightKey)
    if (existing) return existing

    const promise = this.loadOneInner(project, desc, projectRoot, generation, priority, regKey)
    this.inFlight.set(inflightKey, promise)
    try {
      return await promise
    } finally {
      this.inFlight.delete(inflightKey)
    }
  }

  private async loadOneInner(
    project: ProjectDoc,
    desc: AssetDescriptor,
    projectRoot: string,
    generation: number,
    priority: AssetLoadPriority,
    regKey: string,
  ): Promise<'loaded' | 'cancelled' | { reason: string }> {
    let bytes: Uint8Array | null = null
    if (desc.dataUrl) {
      bytes = dataUrlToBytes(desc.dataUrl)
      if (!bytes || bytes.length === 0) {
        this.logFailureOnce(desc.path, 'empty_bytes')
        return { reason: 'empty_bytes' }
      }
    } else if (projectRoot) {
      bytes = await this.deps.readProjectFileBytes(projectRoot, desc.path)
      if (!bytes) {
        this.logFailureOnce(desc.path, 'read_failed')
        return { reason: 'read_failed' }
      }
    } else {
      this.logFailureOnce(desc.path, 'read_failed')
      return { reason: 'read_failed' }
    }

    if (!this.isGenerationCurrent(generation, priority)) return 'cancelled'

    if (!bytes || bytes.length === 0) {
      this.logFailureOnce(desc.path, 'empty_bytes')
      return { reason: 'empty_bytes' }
    }

    const ext = desc.ext ?? extFromPath(desc.path)

    let registered = false
    if (desc.type === 'audio') {
      registered = this.deps.registerAudio(desc.path, bytes, ext)
    } else if (desc.type === 'font') {
      const font = project.fontAssets?.[desc.id]
      const baseSize = font?.defaultSize && font.defaultSize > 0 ? font.defaultSize : 32
      registered = this.deps.registerFont(desc.path, bytes, ext, baseSize)
    } else {
      registered = this.deps.registerImage(desc.path, bytes, ext)
    }
    if (!registered) {
      this.logFailureOnce(desc.path, 'register_rejected')
      return { reason: 'register_rejected' }
    }

    this.registered.add(regKey)
    return 'loaded'
  }
}

/** Default idle scheduler for prefetch (native requestIdleCallback). */
export function scheduleAssetIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn())
  } else {
    fn()
  }
}

const sessionFailureLogs = new Set<string>()

export function resetAssetFailureLogs(): void {
  sessionFailureLogs.clear()
}

export function createDefaultAssetOrchestrator(): AssetOrchestrator {
  return new AssetOrchestrator({
    readProjectFileBytes,
    registerImage: (path, bytes, ext) => {
      if (!isWasmReady()) return false
      return editorRegisterImage(path, bytes, ext)
    },
    registerAudio: (path, bytes, ext) => {
      if (!isWasmReady()) return false
      return editorRegisterAudio(path, bytes, ext)
    },
    registerFont: (path, bytes, ext, baseSize) => {
      if (!isWasmReady()) return false
      return editorRegisterFont(path, bytes, ext, baseSize)
    },
    isRuntimeReady: isWasmReady,
    scheduleIdle: scheduleAssetIdle,
    logFailure: (path, reason) => {
      if (sessionFailureLogs.has(path)) return
      sessionFailureLogs.add(path)
      console.warn(`[Asset] Failed to load: ${path} (${reason})`)
    },
  })
}

/** Shared preview orchestrator (PreviewPanel + RuntimeSyncService). */
export const assetOrchestrator = createDefaultAssetOrchestrator()
