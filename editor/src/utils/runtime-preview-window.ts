import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, once } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { invokeTauri } from './tauri-invoke'
import type { PreviewTransitionBundle } from './runtime-sync-service'

export const RUNTIME_PREVIEW_LABEL = 'runtime-preview'
export const RUNTIME_PREVIEW_ROUTE = '#/runtime-preview'

export const RUNTIME_PREVIEW_START_EVENT = 'runtime-preview:start'
export const RUNTIME_PREVIEW_STOP_EVENT = 'runtime-preview:stop'
export const RUNTIME_PREVIEW_READY_EVENT = 'runtime-preview:ready'
export const RUNTIME_PREVIEW_REQUEST_READY_EVENT = 'runtime-preview:request-ready'
export const RUNTIME_PREVIEW_CLOSED_EVENT = 'runtime-preview:closed'

const RUNTIME_PREVIEW_READY_TIMEOUT_MS = 8_000
const RUNTIME_PREVIEW_MAX_SCREEN_USAGE = 0.8

export interface RuntimePreviewSize {
  x: number
  y: number
}

export function isRuntimePreviewRoute(hash = window.location.hash): boolean {
  return hash === RUNTIME_PREVIEW_ROUTE || hash.startsWith(`${RUNTIME_PREVIEW_ROUTE}?`)
}

function clampPreviewDimension(value: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 1))
}

export function calculateRuntimePreviewWindowSize(
  logicalSize: RuntimePreviewSize,
  screenSize: RuntimePreviewSize = {
    x: typeof window !== 'undefined' ? window.screen.availWidth : 0,
    y: typeof window !== 'undefined' ? window.screen.availHeight : 0,
  },
): RuntimePreviewSize {
  const logicalWidth = clampPreviewDimension(logicalSize.x)
  const logicalHeight = clampPreviewDimension(logicalSize.y)
  const availableWidth = Math.floor(
    clampPreviewDimension(screenSize.x) * RUNTIME_PREVIEW_MAX_SCREEN_USAGE,
  )
  const availableHeight = Math.floor(
    clampPreviewDimension(screenSize.y) * RUNTIME_PREVIEW_MAX_SCREEN_USAGE,
  )
  const scaleX = Math.floor(availableWidth / logicalWidth)
  const scaleY = Math.floor(availableHeight / logicalHeight)
  const scale = Math.max(1, Math.min(scaleX, scaleY))
  return {
    x: logicalWidth * scale,
    y: logicalHeight * scale,
  }
}

export async function openRuntimePreviewSession(
  size: RuntimePreviewSize,
  bundle: PreviewTransitionBundle,
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Runtime preview window is only available in the desktop shell.')
  }

  let resolveReady!: () => void
  let rejectReady!: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  const timeoutId = window.setTimeout(() => {
    rejectReady(new Error('Runtime preview window did not become ready.'))
  }, RUNTIME_PREVIEW_READY_TIMEOUT_MS)
  const cancelReady = await once(RUNTIME_PREVIEW_READY_EVENT, () => resolveReady())
  try {
    const windowSize = calculateRuntimePreviewWindowSize(size)
    await invokeTauri<void>('open_runtime_preview_window', {
      width: windowSize.x,
      height: windowSize.y,
    })
    await emitTo(RUNTIME_PREVIEW_LABEL, RUNTIME_PREVIEW_REQUEST_READY_EVENT)
    await ready
    await emitTo(RUNTIME_PREVIEW_LABEL, RUNTIME_PREVIEW_START_EVENT, bundle)
  } finally {
    window.clearTimeout(timeoutId)
    cancelReady()
  }
}

export async function closeRuntimePreviewSession(): Promise<void> {
  if (!isTauri()) return
  await emitTo(RUNTIME_PREVIEW_LABEL, RUNTIME_PREVIEW_STOP_EVENT)
  await invokeTauri<void>('close_runtime_preview_window')
}

export async function toggleRuntimePreviewFullscreen(): Promise<void> {
  if (!isTauri()) return
  await invokeTauri<void>('toggle_runtime_preview_fullscreen')
}

export function listenRuntimePreviewClosed(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(RUNTIME_PREVIEW_CLOSED_EVENT, handler)
}
