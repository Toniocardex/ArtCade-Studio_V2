import { useRef, useLayoutEffect, useEffect, useState } from 'react'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { isReady } from '../utils/wasm-bridge'
import { assetOrchestrator } from '../utils/asset-orchestrator'
import { watchProjectAssets } from '../utils/asset-watcher'
import { dirName } from '../utils/project'
import {
  reloadProjectAudioAsset,
  reloadProjectFontAsset,
  reloadProjectImageAsset,
} from '../utils/reload-project-asset'
import { runtimeSync, type EditorTool } from '../utils/runtime-sync-service'
import { clampEditorZoom, computeFitZoom } from '../utils/editor-zoom'
import { zoomFitRegistry } from '../utils/zoom-fit-registry'
import {
  EDITOR_ZOOM_WHEEL_FACTOR, DEFAULT_SCENE_SIZE,
} from '../constants/editor-viewport'
import {
  useWasmRuntimeLifecycle,
  useRuntimeProjectSync,
  useRuntimeAssetUpload,
  useRuntimeEditorSync,
} from './preview/runtime-hooks'
import {
  computeVisibleWorldCenter,
  setEditorVisibleWorldCenter,
} from '../utils/editor-viewport-center'
import { normalizeEntityPosition } from '../utils/entity-position'
import { CanvasToolbar } from './preview/CanvasToolbar'
import { RuntimeStatusBadge } from './preview/RuntimeStatusBadge'
import { ProjectHealthBanner } from './preview/ProjectHealthBanner'
import { CameraFrameOverlay } from './preview/CameraFrameOverlay'
import { CanvasViewportWithRulers } from './preview/CanvasViewportWithRulers'
import { CanvasFooterBar } from './preview/CanvasFooterBar'

type TransformSnapshot = {
  entityId: number
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

function sameTransform(a: TransformSnapshot, b: TransformSnapshot): boolean {
  const epsilon = 1e-4
  return a.entityId === b.entityId &&
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.rotation - b.rotation) < epsilon &&
    Math.abs(a.scaleX - b.scaleX) < epsilon &&
    Math.abs(a.scaleY - b.scaleY) < epsilon
}

function panCursorStyle(isPanning: boolean, tool: EditorTool): string {
  if (isPanning) return 'grabbing'
  if (tool === 'pan') return 'grab'
  return 'default'
}

export default function PreviewPanel() {
  // useEditor() subscribes ONLY to CoreContext. It does NOT subscribe to
  // VolatileContext, so this component is NOT re-rendered on every
  // debug.log() call from Lua. Re-rendering PreviewPanel during the WASM
  // rAF callback would race React reconciliation with WebGL compositing
  // and surface as a one-frame flash. The context split in
  // editor-store.tsx prevents this entirely.
  const { state, dispatch } = useEditor()
  const {
    project, projectPath, isPlaying, selection, selectedTileCell, mode,
    editorGridSize, snapToGrid, editorZoom, editorZoomMode, cameraPreview,
    previewAssetLoadScope,
    openScripts,
  } = state

  const canvasRef           = useRef<HTMLCanvasElement>(null)
  const scrollRef           = useRef<HTMLDivElement>(null)
  const sceneIdRef          = useRef<string>('')
  const projectRef          = useRef(project)
  const projectPathRef      = useRef(projectPath)
  const previewScopeRef     = useRef(previewAssetLoadScope)
  const snapToGridRef       = useRef(false)
  const gridSizeRef         = useRef(32)
  const ignoredTransformEchoRef = useRef<TransformSnapshot | null>(null)

  sceneIdRef.current    = selection.sceneId ?? project?.activeSceneId ?? ''
  projectRef.current    = project
  projectPathRef.current = projectPath
  previewScopeRef.current = previewAssetLoadScope
  snapToGridRef.current = snapToGrid
  gridSizeRef.current   = editorGridSize

  const [wasmReady,   setWasmReady]        = useState(() => isReady())
  const [engineReady, setEngineReady]      = useState(() => isReady())
  const [activeTool,  setActiveTool]       = useState<EditorTool>('select')
  const [showEditorGuides, setShowEditorGuides] = useState(true)

  /** UI must reflect the window singleton (StrictMode/HMR can skip onReady). */
  const syncRuntimeUiFlags = () => {
    if (!isReady()) return
    setWasmReady(true)
    setEngineReady(true)
    runtimeSync.notifyEngineReady()
  }

  function handleRuntimeTransform(
    entityId: number, x: number, y: number,
    rotation: number, scaleX: number, scaleY: number,
  ) {
    const incoming: TransformSnapshot = { entityId, x, y, rotation, scaleX, scaleY }
    if (ignoredTransformEchoRef.current && sameTransform(ignoredTransformEchoRef.current, incoming)) {
      ignoredTransformEchoRef.current = null
      return
    }

    const { x: nextX, y: nextY } = normalizeEntityPosition(
      x, y, snapToGridRef.current, gridSizeRef.current,
    )
    const snapped: TransformSnapshot = { entityId, x: nextX, y: nextY, rotation, scaleX, scaleY }

    if (nextX !== x || nextY !== y) {
      ignoredTransformEchoRef.current = snapped
      runtimeSync.syncEntityTransform(snapped)
    } else {
      // Mark this value as already in sync so a later React-side edit at
      // the same position does not bounce back to the runtime.
      runtimeSync.noteTransform(snapped)
    }
    dispatch({
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId, x: nextX, y: nextY, rotation, scaleX, scaleY,
    })
  }

  useLayoutEffect(() => { syncRuntimeUiFlags() })

  useWasmRuntimeLifecycle({
    canvasRef, mode, dispatch, setEngineReady,
    sceneIdRef, syncRuntimeUiFlags, handleRuntimeTransform,
    makeLogEntry,
  })

  useRuntimeProjectSync({
    project, projectPath, openScripts,
    dialogs: state.dialogs,
    selectionSceneId: selection.sceneId,
    wasmReady, engineReady,
    isPlaying,
    dispatch,
    makeLogEntry,
  })

  useRuntimeAssetUpload({
    project,
    projectPath,
    activeSceneId: selection.sceneId ?? project?.activeSceneId ?? null,
    wasmReady,
    engineReady,
    previewAssetLoadScope,
  })

  useEffect(() => {
    runtimeSync.setPreviewAssetLoadScope(previewAssetLoadScope)
  }, [previewAssetLoadScope])

  useEffect(() => {
    runtimeSync.setAssetCacheInvalidator(() => {
      assetOrchestrator.clearRegistered()
      const p = projectRef.current
      const sid = sceneIdRef.current
      const root = projectPathRef.current ? dirName(projectPathRef.current) : ''
      if (p && sid) {
        void assetOrchestrator.loadScene(p, sid, root, { scope: previewScopeRef.current })
      }
    })
    return () => runtimeSync.setAssetCacheInvalidator(null)
  }, [])

  useEffect(() => {
    const root = projectPath ? dirName(projectPath) : ''
    if (!root || !wasmReady || !engineReady) return
    let cancelled = false
    let unwatchFn: (() => void) | null = null
    void watchProjectAssets(root, (relPath) => {
      if (cancelled) return
      const p = projectRef.current
      if (!p) return
      const image = Object.values(p.assets ?? {}).find((a) => a.path === relPath)
      if (image) {
        void reloadProjectImageAsset(root, image).then((ok) => {
          if (ok && !cancelled) {
            dispatch({
              type: 'LOG',
              entry: makeLogEntry(`[Asset] Reloaded: ${relPath}`, 'info'),
            })
          }
        })
        return
      }
      const audio = Object.values(p.audioAssets ?? {}).find((a) => a.path === relPath)
      if (audio) {
        void reloadProjectAudioAsset(root, audio).then((ok) => {
          if (ok && !cancelled) {
            dispatch({
              type: 'LOG',
              entry: makeLogEntry(`[Asset] Reloaded: ${relPath}`, 'info'),
            })
          }
        })
        return
      }
      const font = Object.values(p.fontAssets ?? {}).find((a) => a.path === relPath)
      if (!font) return
      void reloadProjectFontAsset(root, font).then((ok) => {
        if (ok && !cancelled) {
          dispatch({
            type: 'LOG',
            entry: makeLogEntry(`[Asset] Reloaded: ${relPath}`, 'info'),
          })
        }
      })
    }).then((fn) => {
      if (cancelled) {
        void fn?.()
        return
      }
      unwatchFn = () => { void fn?.() }
    })
    return () => {
      cancelled = true
      unwatchFn?.()
    }
  }, [projectPath, wasmReady, engineReady, dispatch])

  // All per-frame editor channels (mode, selection, tool, chrome) go
  // through RuntimeSyncService — there is exactly one place that owns the
  // "what reaches the runtime, when?" contract.
  useRuntimeEditorSync({
    wasmReady, engineReady,
    isPlaying,
    selectedEntityId: selection.entityId,
    tool: activeTool,
    selectedTileCell,
    guides: showEditorGuides,
    gridSize: editorGridSize,
    snapToGrid,
  })

  const selectedSceneId = selection.sceneId ?? project?.activeSceneId
  const selectedScene = project && selectedSceneId ? project.scenes[selectedSceneId] : undefined
  // The editor canvas matches the SCENE worldSize (the playable level).
  // Long levels (e.g. 4096x640 platformer) → the surrounding container has
  // overflow:auto so scrollbars appear; the pan tool still works for camera
  // dragging. viewportSize is drawn as an amber overlay by the C++
  // editor-overlay-renderer.
  const res = selectedScene?.worldSize ?? DEFAULT_SCENE_SIZE
  const vp  = selectedScene?.viewportSize ?? res
  const zoom = editorZoom
  const scaledW = Math.round(res.x * zoom)
  const scaledH = Math.round(res.y * zoom)

  // Camera preview: clip the visual footprint to viewportSize while keeping
  // the canvas mounted at its full worldSize. The canvas is positioned with a
  // negative offset so the centred viewport region aligns with the wrapper's
  // origin; the wrapper's overflow:hidden clips the rest. We never unmount
  // the canvas — toggling preview must not reset the WebGL context.
  //
  // `preview` is the *effective* state: user intent (`cameraPreview`) AND a
  // viewport that actually differs from the world. StatusBar mirrors this
  // derivation so the pill never lies.
  const preview = cameraPreview && (vp.x !== res.x || vp.y !== res.y)
  const showCameraFrame = !isPlaying && mode === 'canvas' && (vp.x < res.x || vp.y < res.y)
  const frameW   = preview ? Math.round(vp.x * zoom) : scaledW
  const frameH   = preview ? Math.round(vp.y * zoom) : scaledH
  const canvasDX = preview ? -Math.round(((res.x - vp.x) / 2) * zoom) : 0
  const canvasDY = preview ? -Math.round(((res.y - vp.y) / 2) * zoom) : 0

  /**
   * Fit zoom honours the current view mode: when camera-preview clips the
   * canvas to viewportSize, fitting computes against `vp`, not `res` — so
   * Ctrl+9 actually makes the viewport rectangle fit the panel, instead of
   * fitting the wider world that the user isn't even looking at.
   *
   * Dispatches EDITOR_SET_FIT_ZOOM (not _SET_ZOOM) so editorZoomMode stays
   * 'fit'. The ResizeObserver below relies on that to re-fit on any panel
   * size change.
   */
  function fitZoom() {
    const el = scrollRef.current
    if (!el) return
    const sceneW = preview ? vp.x : res.x
    const sceneH = preview ? vp.y : res.y
    dispatch({
      type: 'EDITOR_SET_FIT_ZOOM',
      zoom: computeFitZoom(el.clientWidth, el.clientHeight, sceneW, sceneH),
    })
  }

  // Expose fitZoom to App.tsx's Ctrl+9 shortcut via a typed registry instead
  // of a window CustomEvent (TECHNICAL_DEBT_REVIEW §3). useLayoutEffect runs
  // before paint so the handler is in place by the time the user can press
  // a key in the freshly mounted editor.
  useLayoutEffect(() => zoomFitRegistry.register(fitZoom), [preview, res.x, res.y, vp.x, vp.y])

  // Track-on-resize: when the user is in 'fit' mode, any panel size change
  // (window resize, side-panel toggle, bottom-tab open/close) recomputes the
  // fit zoom so the scene stays fully visible and centred. The moment the
  // user picks any other zoom (preset, +/-, wheel, Ctrl+0, manual entry) the
  // reducer flips mode to 'manual' and this observer becomes a no-op.
  //
  // Why ResizeObserver and not window resize? The scroll area shrinks and
  // grows without the window resizing — toggling the console dock or left
  // assets panel is the obvious case, and a window-only listener would miss it.
  useLayoutEffect(() => {
    if (editorZoomMode !== 'fit') return
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      // requestAnimationFrame avoids running fit logic during layout.
      requestAnimationFrame(() => fitZoom())
    })
    ro.observe(el)
    return () => ro.disconnect()
    // We want the observer up whenever fit-mode is on; recreate it if scene
    // dimensions change so the latest sceneW/sceneH go into computeFitZoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorZoomMode, res.x, res.y, vp.x, vp.y, preview])

  // Publish visible world centre for default entity spawn (scroll + zoom aware).
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) {
      setEditorVisibleWorldCenter(null)
      return undefined
    }
    const publish = () => {
      setEditorVisibleWorldCenter(
        computeVisibleWorldCenter(
          el.scrollLeft, el.scrollTop, el.clientWidth, el.clientHeight, editorZoom,
        ),
      )
    }
    publish()
    el.addEventListener('scroll', publish, { passive: true })
    const ro = new ResizeObserver(() => publish())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', publish)
      ro.disconnect()
      setEditorVisibleWorldCenter(null)
    }
  }, [editorZoom, res.x, res.y, selectedSceneId])

  useEffect(() => {
    if (!isPlaying) return
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => el.focus({ preventScroll: true }))
  }, [isPlaying])

  const prevSelectedEntityRef = useRef<number | null>(null)
  useEffect(() => {
    const entityId = selection.entityId
    if (entityId == null || !project) return
    if (prevSelectedEntityRef.current === entityId) return
    prevSelectedEntityRef.current = entityId
    const def = project.entities[entityId]
    if (!def) return
    const el = scrollRef.current
    if (!el) return
    const z = editorZoom > 0 ? editorZoom : 1
    const { x, y } = def.transform.position
    const targetX = x * z - el.clientWidth * 0.5
    const targetY = y * z - el.clientHeight * 0.5
    const maxX = Math.max(0, el.scrollWidth - el.clientWidth)
    const maxY = Math.max(0, el.scrollHeight - el.clientHeight)
    el.scrollLeft = Math.min(maxX, Math.max(0, targetX))
    el.scrollTop  = Math.min(maxY, Math.max(0, targetY))
  }, [selection.entityId, project, editorZoom])

  // -------------------------------------------------------------- pan tool
  //
  // In editor mode the C++ camera is locked (worldSize == viewportSize,
  // zoom 1, no offset) — there is nothing to pan inside the runtime. What
  // "Pan" means here is: drag the OUTER scroll container so the user can
  // navigate a large level (e.g. 4096x640 platformer). The native scrollbars
  // already do this, but click-drag is the universal expectation (Figma,
  // Aseprite, Photoshop) and it's what the toolbar button promises.
  //
  // Design:
  //   • activeTool === 'pan'  → wrapper catches pointerdown, sets the canvas
  //     to pointer-events:none so the runtime's native click-to-select stays
  //     out of the way, and translates pointer delta into scrollLeft/Top.
  //   • Middle mouse button   → always pans, regardless of the active tool
  //     (industry-standard ergonomic; the canvas keeps pointer-events:auto
  //     but middle-button is unused by C++ so the native listener is a no-op).
  //   • isPanning state drives the cursor (grab/grabbing) and forces a single
  //     re-render at start + end; the per-frame delta uses panStartRef only
  //     so the drag loop doesn't go through React reconciliation.
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{
    pointerId: number
    clientX: number; clientY: number
    scrollX: number; scrollY: number
  } | null>(null)

  function onCanvasAreaPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current
    if (!el) return
    const wantsPan = e.button === 1 || (e.button === 0 && activeTool === 'pan')
    if (!wantsPan) return

    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    panStartRef.current = {
      pointerId: e.pointerId,
      clientX:   e.clientX,
      clientY:   e.clientY,
      scrollX:   el.scrollLeft,
      scrollY:   el.scrollTop,
    }
    setIsPanning(true)
  }

  function onCanvasAreaPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pan = panStartRef.current
    const el  = scrollRef.current
    if (!pan || !el) return
    el.scrollLeft = pan.scrollX - (e.clientX - pan.clientX)
    el.scrollTop  = pan.scrollY - (e.clientY - pan.clientY)
  }

  function onCanvasAreaPointerUp() {
    const pan = panStartRef.current
    const el  = scrollRef.current
    if (!pan || !el) return
    if (el.hasPointerCapture(pan.pointerId)) el.releasePointerCapture(pan.pointerId)
    panStartRef.current = null
    setIsPanning(false)
  }

  const panActive = activeTool === 'pan' || isPanning
  const panCursor = panCursorStyle(isPanning, activeTool)

  // Ctrl + wheel: zoom anchored at the cursor (Figma/Photoshop behaviour).
  // Without anchoring, zooming "in" always re-centres on the world origin and
  // the user loses the point they were inspecting.
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey) return
    e.preventDefault()
    const el = scrollRef.current
    if (!el) return

    // Cursor position relative to the scroll container's viewport.
    const rect    = el.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    // World point currently under the cursor (independent of zoom).
    const worldX = (el.scrollLeft + cursorX) / zoom
    const worldY = (el.scrollTop  + cursorY) / zoom

    // Exponential step keeps the "feel" linear regardless of current zoom.
    const factor = e.deltaY < 0 ? EDITOR_ZOOM_WHEEL_FACTOR : 1 / EDITOR_ZOOM_WHEEL_FACTOR
    const nextZoom = clampEditorZoom(zoom * factor)
    dispatch({ type: 'EDITOR_SET_ZOOM', zoom: nextZoom })

    // After React applies the new wrapper width, scroll so the cursor still
    // sits on the same world point. requestAnimationFrame waits for the
    // re-render so scrollWidth/scrollHeight reflect the new size.
    requestAnimationFrame(() => {
      if (!scrollRef.current) return
      scrollRef.current.scrollLeft = worldX * nextZoom - cursorX
      scrollRef.current.scrollTop  = worldY * nextZoom - cursorY
    })
  }

  // Background colour while WASM has not yet painted (prevents white flash).
  const bgColor = (() => {
    const bg = selectedScene?.backgroundColor
    return bg
      ? `rgb(${Math.round(bg.x * 255)},${Math.round(bg.y * 255)},${Math.round(bg.z * 255)})`
      : 'var(--bg)'
  })()

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]">
      <CanvasToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        selectedTileCell={selectedTileCell}
        showGuides={showEditorGuides}
        onToggleGuides={() => setShowEditorGuides(v => !v)}
        rightSlot={(
          <div className="flex items-center gap-2">
            <ProjectHealthBanner projectKey={projectPath} />
            <RuntimeStatusBadge wasmReady={wasmReady} hasProject={!!project} />
          </div>
        )}
      />

      <CanvasViewportWithRulers
        scrollRef={scrollRef}
        zoom={zoom}
        worldWidth={res.x}
        worldHeight={res.y}
        onWheel={handleWheel}
        onPointerDown={onCanvasAreaPointerDown}
        onPointerMove={onCanvasAreaPointerMove}
        onPointerUp={onCanvasAreaPointerUp}
        onPointerCancel={onCanvasAreaPointerUp}
        style={{ cursor: panCursor }}
      >
        <div className="min-w-full min-h-full flex items-center justify-center">
          {/* Sized wrapper = the visual footprint of the canvas at the current
              zoom. Layout uses this size for scrolling; the canvas inside is
              still at native worldSize and is visually scaled via CSS
              transform. The C++ input controller picks the correct mouse
              coords because it reads CSS-vs-internal canvas size at runtime. */}
          <div
            className="canvas-scene-frame"
            style={{
              width:     `${frameW}px`,
              height:    `${frameH}px`,
              boxShadow: preview
                ? '0 0 0 2px var(--accent-2), 0 25px 50px -12px rgb(0 0 0 / 0.5)'
                : '0 25px 50px -12px rgb(0 0 0 / 0.5)',
            }}
          >
            <canvas
              ref={canvasRef}
              id="artcade-canvas"
              width={res.x}
              height={res.y}
              onContextMenu={isPlaying ? (e) => e.preventDefault() : undefined}
              style={{
                display:         'block',
                position:        'absolute',
                top:             `${canvasDY}px`,
                left:            `${canvasDX}px`,
                width:           `${res.x}px`,
                height:          `${res.y}px`,
                transform:       `scale(${zoom})`,
                transformOrigin: '0 0',
                background:      bgColor,
                // Let pan-drag pass through to the scroll wrapper while the
                // pan tool (or a live middle-button pan) is active. Otherwise
                // the runtime's native canvas listeners would swallow the
                // mousedown and the scrollLeft/Top handler never fires.
                pointerEvents:   panActive ? 'none' : 'auto',
              }}
            />
            {showCameraFrame && (
              <CameraFrameOverlay
                worldSize={res}
                viewportSize={vp}
                zoom={zoom}
                fillFrame={preview}
              />
            )}
            {/* Scene edge — always on, independent of grid guides. */}
            <div className="canvas-scene-frame__edge" aria-hidden />
          </div>
        </div>
      </CanvasViewportWithRulers>

      <CanvasFooterBar />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogEntry(message: string, level: string): ConsoleEntry {
  const validLevels = ['info', 'warn', 'error', 'lua'] as const
  return {
    id:      Date.now() + Math.random(),
    time:    new Date().toLocaleTimeString('it-IT', {
               hour: '2-digit', minute: '2-digit', second: '2-digit',
             }),
    message,
    level:   validLevels.includes(level as never)
               ? (level as ConsoleEntry['level'])
               : 'info',
  }
}
