import { useRef, useLayoutEffect, useEffect, useCallback, useMemo, useState } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { assetOrchestrator, imageAssetDescriptor } from '../utils/asset-orchestrator'
import { watchProjectAssets } from '../utils/asset-watcher'
import { dirName } from '../utils/project'
import { runtimeSync, type EditorTool } from '../utils/runtime-sync-service'
import { DEFAULT_SCENE_SIZE } from '../constants/editor-viewport'
import {
  useWasmRuntimeLifecycle,
  useRuntimeProjectSync,
  useRuntimeAssetUpload,
  useRuntimeEditorSync,
} from './preview/runtime-hooks'
import { computeCanvasViewportLayout } from '../utils/canvas-viewport-layout'
import { normalizeEntityPosition } from '../utils/entity-position'
import { CanvasToolbar } from './preview/CanvasToolbar'
import { CanvasFocusToolbar } from './preview/CanvasFocusToolbar'
import { RuntimeStatusBadge } from './preview/RuntimeStatusBadge'
import { ProjectHealthBanner } from './preview/ProjectHealthBanner'
import { CameraFrameOverlay } from './preview/CameraFrameOverlay'
import { CanvasViewportWithRulers } from './preview/CanvasViewportWithRulers'
import { useLayoutTier } from '../contexts/editor-layout-tier-context'
import { InspectorDrawerToggle } from '../contexts/inspector-drawer-context'
import { ExplorerDrawerToggle } from '../contexts/explorer-drawer-context'
import { useRuntimeReadiness } from '../hooks/useRuntimeReadiness'
import { useEditorCanvasViewport } from '../hooks/useEditorCanvasViewport'
import { useEditorFitZoom } from '../hooks/useEditorFitZoom'
import { getRuntimeCanvas } from '../utils/runtime-canvas'
import { editorSetEditCamera, setTextureCacheEvictedCallback } from '../utils/wasm-bridge'
import { TilePaintOverlay } from './preview/TilePaintOverlay'
import { createTilemap, createTilemapForNewLayer, resolveTilemapTileSize } from '../types'

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

export type PreviewPanelProps = Readonly<{
  activeTool: EditorTool
  onSelectTool: (tool: EditorTool) => void
  showToolPalette?: boolean
}>

export default function PreviewPanel({
  activeTool,
  onSelectTool,
  showToolPalette = true,
}: PreviewPanelProps) {
  // useEditorSelector reads CoreStateStore only — not VolatileContext — so
  // this panel is NOT re-rendered on every debug.log() from Lua. Re-rendering
  // PreviewPanel during the WASM rAF callback would race React reconciliation
  // with WebGL compositing and surface as a one-frame flash. The Core/Volatile
  // split in editor-store.tsx prevents this entirely.
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const isPlaying = useEditorSelector((s) => s.isPlaying)
  const selection = useEditorSelector((s) => s.selection)
  const selectedTileCell = useEditorSelector((s) => s.selectedTileCell)
  const mode = useEditorSelector((s) => s.mode)
  const editorGridSize = useEditorSelector((s) => s.editorGridSize)
  const snapToGrid = useEditorSelector((s) => s.snapToGrid)
  const editorZoom = useEditorSelector((s) => s.editorZoom)
  const editorZoomMode = useEditorSelector((s) => s.editorZoomMode)
  const cameraPreview = useEditorSelector((s) => s.cameraPreview)
  const activePaintTilesetId = useEditorSelector((s) => s.activePaintTilesetId)
  const editorActiveLayer = useEditorSelector((s) => s.editorActiveLayer)
  const openScripts = useEditorSelector((s) => s.openScripts)
  const focusMode = useEditorSelector((s) => s.focusMode)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const editorGuidesVisible = useEditorSelector((s) => s.editorGuidesVisible)
  const editorRulerStep = useEditorSelector((s) => s.editorRulerStep)
  const editorRulersVisible = useEditorSelector((s) => s.editorRulersVisible)

  const canvasRef           = useRef<HTMLCanvasElement>(null)
  const canvasHostRef       = useRef<HTMLDivElement>(null)
  const [runtimeCanvasReady, setRuntimeCanvasReady] = useState(false)
  const scrollRef           = useRef<HTMLDivElement>(null)
  const sceneIdRef          = useRef<string>('')
  const projectRef          = useRef(project)
  const projectPathRef      = useRef(projectPath)
  const snapToGridRef       = useRef(false)
  const gridSizeRef         = useRef(32)
  const ignoredTransformEchoRef = useRef<TransformSnapshot | null>(null)
  const bootSyncRef = useRef({
    project: null as typeof project,
    projectPath: null as typeof projectPath,
    openScripts: [] as typeof openScripts,
    dialogs: {} as typeof dialogs,
    selectionSceneId: null as string | null,
    isPlaying: false,
  })

  sceneIdRef.current    = selection.sceneId ?? project?.activeSceneId ?? ''
  projectRef.current    = project
  projectPathRef.current = projectPath
  snapToGridRef.current = snapToGrid
  gridSizeRef.current   = editorGridSize
  bootSyncRef.current = {
    project,
    projectPath,
    openScripts,
    dialogs,
    selectionSceneId: selection.sceneId,
    isPlaying,
  }

  const tier = useLayoutTier()
  const showInspectorToggle = tier !== 'full'
  const showExplorerToggle = tier === 'minimal' || tier === 'unsupported'

  const { wasmReady, engineReady, syncWasmFromBridge } = useRuntimeReadiness()
  const syncRuntimeUiFlags = useCallback(() => {
    syncWasmFromBridge()
  }, [syncWasmFromBridge])

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

  // Adopt the singleton runtime canvas (see utils/runtime-canvas.ts). The
  // engine's GL context is bound to that one element forever, so the panel
  // re-parents it instead of letting React mint a new <canvas> per mount —
  // a fresh element would never receive a frame.
  useLayoutEffect(() => {
    const canvas = getRuntimeCanvas()
    canvasRef.current = canvas
    canvasHostRef.current?.appendChild(canvas)
    setRuntimeCanvasReady(true)
    return () => {
      canvas.remove()
      if (canvasRef.current === canvas) canvasRef.current = null
      setRuntimeCanvasReady(false)
    }
  }, [])

  // Mount-only: wasm-bridge onReady also calls syncRuntimeUiFlags; do not run
  // every render (causes "Maximum update depth exceeded").
  useLayoutEffect(() => {
    syncRuntimeUiFlags()
  }, [syncRuntimeUiFlags])

  useRuntimeProjectSync({
    project, projectPath, openScripts,
    dialogs,
    selectionSceneId: selection.sceneId,
    wasmReady, engineReady,
    isPlaying,
    dispatch,
    makeLogEntry,
  })

  useWasmRuntimeLifecycle({
    canvasRef, canvasReady: runtimeCanvasReady, mode, dispatch,
    sceneIdRef, syncRuntimeUiFlags, handleRuntimeTransform,
    makeLogEntry, bootSyncRef,
  })

  useRuntimeAssetUpload({
    project,
    projectPath,
    activeSceneId: selection.sceneId ?? project?.activeSceneId ?? null,
    wasmReady,
    engineReady,
  })

  // When any C++ call evicts the texture cache (load/play/stop), the bridge fires
  // _onTextureCacheEvicted synchronously. Clearing the JS registry here ensures the
  // next syncProjectAssets or assetCacheInvalidator pass re-uploads all textures.
  useEffect(() => {
    setTextureCacheEvictedCallback(() => assetOrchestrator.clearRegistered())
    return () => setTextureCacheEvictedCallback(null)
  }, [])

  useEffect(() => {
    runtimeSync.setAssetCacheInvalidator(() => {
      const p = projectRef.current
      const sid = sceneIdRef.current
      const root = projectPathRef.current ? dirName(projectPathRef.current) : ''
      if (p && sid) {
        void assetOrchestrator.loadScene(p, sid, root)
      }
    })
    return () => runtimeSync.setAssetCacheInvalidator(null)
  }, [])

  useEffect(() => {
    if (!activePaintTilesetId || !wasmReady || !engineReady || !project) return
    const tileset = project.tilesets?.[activePaintTilesetId]
    if (!tileset?.spriteImagePath?.trim()) return
    const root = projectPath ? dirName(projectPath) : ''
    void assetOrchestrator.ensureTilesetImageRegistered(project, tileset, root)
  }, [activePaintTilesetId, wasmReady, engineReady, project, projectPath])

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
        void assetOrchestrator.reloadAsset(p, imageAssetDescriptor(image), root).then((ok) => {
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
        void assetOrchestrator.reloadAsset(p, {
          id: audio.id,
          type: 'audio',
          path: audio.path,
        }, root).then((ok) => {
          if (ok && !cancelled) {
            dispatch({
              type: 'LOG',
              entry: makeLogEntry(`[Asset] Reloaded: ${relPath}`, 'info'),
            })
          }
        })
        return
      }
      const tileset = Object.values(p.tilesets ?? {}).find((t) => t.spriteImagePath === relPath)
      if (tileset) {
        void assetOrchestrator.reloadTilesetImage(p, tileset, root).then((ok) => {
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
      void assetOrchestrator.reloadAsset(p, {
        id: font.id,
        type: 'font',
        path: font.path,
      }, root).then((ok) => {
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
    activeTileLayer: editorActiveLayer,
    // The runtime draws the alignment grid under the sprites (its native,
    // correct z-order). The camera-viewport outline is the editor's dashed DOM
    // overlay (CameraFrameOverlay) — the runtime no longer draws it.
    guides: editorGuidesVisible,
    gridSize: editorGridSize,
    snapToGrid,
  })

  const selectedSceneId = selection.sceneId ?? project?.activeSceneId
  const selectedScene = project && selectedSceneId ? project.scenes[selectedSceneId] : undefined
  const paintTilemap = useMemo(() => {
    if (!selectedScene || !project) return undefined
    const layerTm = selectedScene.tilemapLayers?.[editorActiveLayer]
    if (layerTm) return layerTm
    const tileSize = resolveTilemapTileSize(
      project,
      selectedScene,
      activePaintTilesetId ?? undefined,
    )
    return createTilemapForNewLayer(
      selectedScene.worldSize.x,
      selectedScene.worldSize.y,
      tileSize,
      selectedScene,
    )
  }, [selectedScene, editorActiveLayer, activePaintTilesetId, project])
  const res = selectedScene?.worldSize ?? DEFAULT_SCENE_SIZE
  const vp  = selectedScene?.viewportSize ?? res
  const zoom = editorZoom

  // During play the engine applies ViewportPolicy::NativePlay: the canvas is
  // resized to the scene viewport (the camera lens), not the world. The frame
  // and canvas presentation must follow, or the engine-resized canvas sits
  // unscaled in the corner of a world-sized frame.
  const frame = isPlaying ? vp : res

  const preview = !isPlaying && cameraPreview && (vp.x !== res.x || vp.y !== res.y)
  const showCameraFrame = !isPlaying && mode === 'canvas' && (vp.x < res.x || vp.y < res.y)
  const layout = useMemo(
    () => computeCanvasViewportLayout({
      worldSize: frame,
      viewportSize: vp,
      zoom,
      preview,
      rulerStep: editorRulerStep,
    }),
    [frame.x, frame.y, vp.x, vp.y, zoom, preview, editorRulerStep],
  )
  const frameW = layout.contentSizePx.x
  const frameH = layout.contentSizePx.y

  useEditorFitZoom({
    scrollRef,
    dispatch,
    editorZoomMode,
    preview,
    sceneWidth: frame.x,
    sceneHeight: frame.y,
    viewportWidth: vp.x,
    viewportHeight: vp.y,
  })

  const {
    panActive,
    panCursor,
    onPointerDown: onCanvasAreaPointerDown,
    onPointerMove: onCanvasAreaPointerMove,
    onPointerUp: onCanvasAreaPointerUp,
    onWheel: handleWheel,
  } = useEditorCanvasViewport({
    scrollRef,
    layout,
    zoom,
    preview,
    worldSize: res,
    viewportSize: vp,
    dispatch,
    selectedSceneId,
    selectedEntityId: selection.entityId,
    project,
    isPlaying,
    activeTool,
  })

  const bgColor = (() => {
    const bg = selectedScene?.backgroundColor
    return bg
      ? `rgb(${Math.round(bg.x * 255)},${Math.round(bg.y * 255)},${Math.round(bg.z * 255)})`
      : 'var(--bg)'
  })()

  // The runtime canvas is a persistent DOM node React does not manage, so its
  // presentation is applied imperatively.
  //
  //  • Edit mode: the canvas is a fixed layer the size of the visible viewport
  //    (sticky in the scroll container). The runtime renders the panned/zoomed
  //    world slice into it at native resolution — NO CSS transform — so the
  //    framebuffer is never GPU-downscaled (crisp 1px grid, correct phase and
  //    full coverage at any zoom). The framebuffer size is owned by the runtime
  //    (editor_set_edit_camera → setWindowSize); we only set the CSS size.
  //  • Play mode: the engine owns the framebuffer (NativePlay SetWindowSize);
  //    the canvas is the scene-viewport size, CSS-scaled to fit.
  const applyCanvasPresentation = useCallback(() => {
    const canvas = getRuntimeCanvas()
    const common = {
      display:         'block',
      position:        'absolute',
      top:             '0px',
      left:            '0px',
      transformOrigin: '0 0',
      background:       bgColor,
      pointerEvents:    panActive ? 'none' : 'auto',
    } as const
    if (isPlaying) {
      Object.assign(canvas.style, common, {
        width:     `${frame.x}px`,
        height:    `${frame.y}px`,
        transform: `scale(${zoom})`,
      })
      return
    }
    const el = scrollRef.current
    const pad = layout.paddingPx
    const cssW = el ? Math.max(1, el.clientWidth  - pad * 2) : frame.x
    const cssH = el ? Math.max(1, el.clientHeight - pad * 2) : frame.y
    Object.assign(canvas.style, common, {
      width:     `${cssW}px`,
      height:    `${cssH}px`,
      transform: 'none',
    })
  }, [isPlaying, frame.x, frame.y, zoom, bgColor, panActive, layout.paddingPx])

  useLayoutEffect(() => {
    applyCanvasPresentation()
  }, [applyCanvasPresentation])

  // Edit-mode preview camera: drive the runtime camera from the scroll
  // container so the world slice under the viewport is rendered at native
  // resolution. target = world point at the canvas top-left; zoom + viewport
  // in device px. Re-assert the CSS afterwards because setWindowSize (fired
  // only when the viewport px change) strips the inline canvas style on
  // Emscripten. Picking/zoom stay consistent because target = scrollLeft/zoom
  // matches the editor's scrollToWorld mapping.
  const camSyncRafRef = useRef<number | null>(null)
  const syncEditCamera = useCallback(() => {
    const el = scrollRef.current
    if (!el || isPlaying || !engineReady) return
    const dpr = window.devicePixelRatio || 1
    const pad = layout.paddingPx
    const cssW = Math.max(1, el.clientWidth  - pad * 2)
    const cssH = Math.max(1, el.clientHeight - pad * 2)
    const z = zoom > 0 ? zoom : 1
    editorSetEditCamera(
      el.scrollLeft / z, el.scrollTop / z,
      z * dpr, cssW * dpr, cssH * dpr,
    )
    applyCanvasPresentation()
  }, [isPlaying, engineReady, zoom, layout.paddingPx, applyCanvasPresentation])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || isPlaying || !engineReady) return
    const schedule = () => {
      if (camSyncRafRef.current != null) return
      camSyncRafRef.current = requestAnimationFrame(() => {
        camSyncRafRef.current = null
        syncEditCamera()
      })
    }
    syncEditCamera()
    el.addEventListener('scroll', schedule, { passive: true })
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', schedule)
      ro.disconnect()
      if (camSyncRafRef.current != null) cancelAnimationFrame(camSyncRafRef.current)
      camSyncRafRef.current = null
    }
  }, [isPlaying, engineReady, syncEditCamera, res.x, res.y, vp.x, vp.y, selectedSceneId])

  // Suppress the browser context menu during play (right click is game input).
  useEffect(() => {
    if (!isPlaying) return
    const canvas = getRuntimeCanvas()
    const block = (e: Event) => e.preventDefault()
    canvas.addEventListener('contextmenu', block)
    return () => canvas.removeEventListener('contextmenu', block)
  }, [isPlaying])

  return (
    <div className="editor-preview-island h-full flex flex-col bg-[var(--bg)]">
      {focusMode ? (
        <CanvasFocusToolbar />
      ) : (
          <CanvasToolbar
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            showToolPalette={showToolPalette}
            rightSlot={(
            <div className="flex items-center gap-2 min-w-0">
              {showExplorerToggle && <ExplorerDrawerToggle />}
              {showInspectorToggle && <InspectorDrawerToggle />}
              <ProjectHealthBanner projectKey={projectPath} />
              <RuntimeStatusBadge wasmReady={wasmReady} hasProject={!!project} compact={showInspectorToggle} />
            </div>
          )}
        />
      )}

      <CanvasViewportWithRulers
        scrollRef={scrollRef}
        layout={layout}
        rulersVisible={editorRulersVisible}
        onWheel={handleWheel}
        onPointerDown={onCanvasAreaPointerDown}
        onPointerMove={onCanvasAreaPointerMove}
        onPointerUp={onCanvasAreaPointerUp}
        onPointerCancel={onCanvasAreaPointerUp}
        style={{ cursor: panCursor }}
      >
        {/* Sticky canvas layer — pinned to the visible viewport (0-size anchor
            keeps it out of the scroll flow). The runtime renders the panned /
            zoomed world slice here at native resolution; the camera follows the
            scroll via syncEditCamera. The persistent canvas (absolute, top/left
            0) is adopted into canvasHostRef. */}
        <div
          style={{ position: 'sticky', top: 0, left: 0, width: 0, height: 0, zIndex: 0 }}
        >
          <div ref={canvasHostRef} style={{ display: 'contents' }} />
          {activePaintTilesetId && !isPlaying && (
            <TilePaintOverlay
              scrollRef={scrollRef}
              zoom={zoom}
              tilemap={paintTilemap}
              activeLayerName={editorActiveLayer}
              selectedTileCell={selectedTileCell}
              sceneId={selectedSceneId ?? ''}
              paintTilesetAssetId={activePaintTilesetId}
              dispatch={dispatch}
            />
          )}
        </div>

        {/* Scrollable spacer — drives the scrollbars and hosts the DOM overlays
            (camera frame + edge ring), sized to world×zoom. Sits above the
            canvas (z-index 1) but is transparent, so the canvas shows through.
            pointerEvents:none lets clicks pass THROUGH to the runtime canvas
            behind it, so the C++ editor controller still receives them for
            entity picking / dragging. Every overlay here is visual-only. */}
        <div
          className="w-fit h-fit shrink-0"
          style={{ width: frameW, height: frameH, position: 'relative', zIndex: 1, pointerEvents: 'none' }}
        >
          <div
            className="canvas-scene-frame"
            style={{
              width:     `${frameW}px`,
              height:    `${frameH}px`,
              boxShadow: preview
                ? '0 0 0 2px var(--accent), 0 25px 50px -12px rgb(0 0 0 / 0.5)'
                : '0 25px 50px -12px rgb(0 0 0 / 0.5)',
            }}
          >
            {showCameraFrame && (
              <CameraFrameOverlay
                worldSize={res}
                viewportSize={vp}
                zoom={zoom}
                fillFrame={preview}
              />
            )}
            <div className="canvas-scene-frame__edge" aria-hidden />
          </div>
        </div>
      </CanvasViewportWithRulers>
    </div>
  )
}

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
