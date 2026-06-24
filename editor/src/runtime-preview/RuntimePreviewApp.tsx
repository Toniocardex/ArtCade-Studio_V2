import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { assetOrchestrator } from '../utils/asset-orchestrator'
import { dirName } from '../utils/project'
import { getRuntimeCanvas } from '../utils/runtime-canvas'
import {
  RUNTIME_PREVIEW_CLOSED_EVENT,
  RUNTIME_PREVIEW_READY_EVENT,
  RUNTIME_PREVIEW_REQUEST_READY_EVENT,
  RUNTIME_PREVIEW_START_EVENT,
  RUNTIME_PREVIEW_STOP_EVENT,
} from '../utils/runtime-preview-window'
import {
  messageForEditorApiCode,
  runtimeSync,
  type PreviewTransitionBundle,
} from '../utils/runtime-sync-service'
import { WASM_RUNTIME_SRC } from '../utils/runtime-path'
import {
  loadWasmRuntime,
  setTextureCacheEvictedCallback,
  type WasmCallbacks,
} from '../utils/wasm-bridge'

type PreviewStatus = 'booting' | 'waiting' | 'loading' | 'running' | 'error'

function runtimeCanvasStyle(background: string): Partial<CSSStyleDeclaration> {
  return {
    display: 'block',
    position: 'absolute',
    inset: '0',
    width: '100vw',
    height: '100vh',
    background,
    imageRendering: 'pixelated',
  }
}

function sceneBackground(bundle: PreviewTransitionBundle | null): string {
  const scene = bundle?.project.scenes[bundle.activeSceneId]
  const color = scene?.backgroundColor
  if (!color) return '#050608'
  return `rgb(${Math.round(color.x * 255)}, ${Math.round(color.y * 255)}, ${Math.round(color.z * 255)})`
}

export default function RuntimePreviewApp() {
  const hostRef = useRef<HTMLDivElement>(null)
  const bundleRef = useRef<PreviewTransitionBundle | null>(null)
  const sessionGenerationRef = useRef(0)
  const closingRef = useRef(false)
  const [canvasReady, setCanvasReady] = useState(false)
  const [wasmReady, setWasmReady] = useState(false)
  const [engineReady, setEngineReady] = useState(() => runtimeSync.isEngineReady())
  const [bundle, setBundle] = useState<PreviewTransitionBundle | null>(null)
  const [status, setStatus] = useState<PreviewStatus>('booting')
  const [message, setMessage] = useState('Loading runtime...')

  bundleRef.current = bundle

  const announceReady = useCallback(() => {
    if (!isTauri()) return
    void emitTo('main', RUNTIME_PREVIEW_READY_EVENT)
  }, [])

  useLayoutEffect(() => {
    const canvas = getRuntimeCanvas()
    Object.assign(canvas.style, runtimeCanvasStyle(sceneBackground(bundleRef.current)))
    hostRef.current?.appendChild(canvas)
    setCanvasReady(true)
    return () => {
      canvas.remove()
      setCanvasReady(false)
    }
  }, [])

  useLayoutEffect(() => {
    Object.assign(getRuntimeCanvas().style, runtimeCanvasStyle(sceneBackground(bundle)))
  }, [bundle])

  useEffect(() => {
    if (!isTauri()) return undefined

    let cancelled = false
    const unlistenFns: Array<() => void> = []

    listen<PreviewTransitionBundle>(RUNTIME_PREVIEW_START_EVENT, (event) => {
      if (cancelled) return
      setBundle(event.payload)
      setStatus('loading')
      setMessage('Loading game...')
    }).then((unlisten) => {
      if (cancelled) unlisten()
      else unlistenFns.push(unlisten)
    })

    listen(RUNTIME_PREVIEW_STOP_EVENT, () => {
      if (cancelled) return
      setStatus('waiting')
      setMessage('Preview stopped.')
      bundleRef.current = null
      setBundle(null)
    }).then((unlisten) => {
      if (cancelled) unlisten()
      else unlistenFns.push(unlisten)
    })

    listen(RUNTIME_PREVIEW_REQUEST_READY_EVENT, () => {
      if (!cancelled) announceReady()
    }).then((unlisten) => {
      if (cancelled) unlisten()
      else unlistenFns.push(unlisten)
    })

    const runtimeWindow = getCurrentWindow()
    runtimeWindow.onCloseRequested(async (event) => {
      event.preventDefault()
      if (closingRef.current) return
      closingRef.current = true
      await emitTo('main', RUNTIME_PREVIEW_CLOSED_EVENT)
      await runtimeWindow.destroy()
    }).then((unlisten) => {
      if (cancelled) unlisten()
      else unlistenFns.push(unlisten)
    })

    announceReady()

    return () => {
      cancelled = true
      unlistenFns.forEach((fn) => fn())
    }
  }, [announceReady])

  useEffect(() => {
    if (!canvasReady) return undefined
    let cancelled = false
    const callbacks: WasmCallbacks = {
      onReady: () => {
        if (cancelled) return
        setWasmReady(true)
        runtimeSync.notifyReadyChanged()
        setStatus((prev) => prev === 'booting' ? 'waiting' : prev)
        setMessage((prev) => prev === 'Loading runtime...' ? 'Waiting for preview...' : prev)
      },
      onEntitySelected: () => undefined,
      onEntityDuplicateRequested: () => undefined,
      onEntityTransformChanged: () => undefined,
      onConsoleLine: (line, level) => {
        if (line.includes('[EditorAPI] Bridge initialised')) {
          runtimeSync.notifyEngineReady()
          setEngineReady(true)
        }
        const log = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
        log('[RuntimePreview]', line)
      },
      onRuntimeProfile: () => undefined,
      onEditorCursorWorld: () => undefined,
    }

    setTextureCacheEvictedCallback(() => assetOrchestrator.clearRegistered())
    void loadWasmRuntime(getRuntimeCanvas(), WASM_RUNTIME_SRC, callbacks).catch((err) => {
      if (cancelled) return
      setStatus('error')
      setMessage(`[WASM] Init failed: ${String(err)}`)
    })

    return () => {
      cancelled = true
      setTextureCacheEvictedCallback(null)
    }
  }, [canvasReady])

  useEffect(() => {
    if (!bundle || !wasmReady || !engineReady) return

    const activeBundle = bundle
    const generation = ++sessionGenerationRef.current
    let cancelled = false

    async function startSession() {
      setStatus('loading')
      setMessage('Loading assets...')
      runtimeSync.reset()
      assetOrchestrator.clearRegistered()

      const projectRoot = activeBundle.projectPath ? dirName(activeBundle.projectPath) : ''
      const assetResult = await assetOrchestrator.loadScene(
        activeBundle.project,
        activeBundle.activeSceneId,
        projectRoot,
      )
      if (cancelled || generation !== sessionGenerationRef.current) return
      if (!assetResult.ok) {
        console.warn('[RuntimePreview] Asset load completed with warnings:', assetResult.failed)
      }

      setMessage('Starting game...')
      const outcome = runtimeSync.transitionPreview('play', activeBundle)
      if (cancelled || generation !== sessionGenerationRef.current) return
      if (!outcome.ok) {
        setStatus('error')
        setMessage(`[Preview] Play failed: ${outcome.message ?? messageForEditorApiCode(outcome.code)}`)
        return
      }
      setStatus('running')
      setMessage('')
    }

    void startSession().catch((err) => {
      if (cancelled) return
      setStatus('error')
      setMessage(`[Preview] Start failed: ${String(err)}`)
    })

    return () => {
      cancelled = true
    }
  }, [bundle, wasmReady, engineReady])

  const showStatus = status !== 'running'

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        overflow: 'hidden',
        background: sceneBackground(bundle),
        color: '#dfe7f5',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      }}
    >
      <div ref={hostRef} style={{ position: 'fixed', inset: 0, overflow: 'hidden' }} />
      {showStatus && (
        <div
          style={{
            position: 'fixed',
            left: 12,
            bottom: 10,
            maxWidth: 'calc(100vw - 24px)',
            padding: '5px 7px',
            border: '1px solid rgb(255 255 255 / 0.12)',
            background: 'rgb(0 0 0 / 0.45)',
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.35,
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}
