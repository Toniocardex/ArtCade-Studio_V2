import { useRef, useLayoutEffect, useEffect, useCallback, useMemo, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { assetOrchestrator, imageAssetDescriptor } from '../utils/asset-orchestrator'
import { watchProjectAssets } from '../utils/asset-watcher'
import { dirName } from '../utils/project'
import { runtimeSync, usePresentationSnapshot, type EditorTool } from '../utils/runtime-sync-service'
import {
  DEFAULT_SCENE_SIZE,
} from '../constants/editor-viewport'
import {
  useWasmRuntimeLifecycle,
  useBootSyncRef,
  useRuntimeProjectSync,
  useRuntimeAssetUpload,
  useRuntimeEditorSync,
  makeRuntimeLogEntry,
} from './preview/runtime-hooks'
import { buildEditorRulerMetrics } from '../utils/editor-ruler-metrics'
import { frameSelectionRegistry } from '../utils/frame-selection-registry'
import { visibleWorldCenterFromSnapshot } from '../utils/editor-camera-from-snapshot'
import {
  editorCenterSceneViewport,
  editorFrameSelectionEntity,
  editorFrameWorld,
  visibleWorldCenterFromCamera,
} from '../utils/editor-viewport-intents'
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
import { useEditorCameraView } from '../hooks/useEditorCameraView'
import { useEditorFitZoom } from '../hooks/useEditorFitZoom'
import { useEditorCanvasViewport } from '../hooks/useEditorCanvasViewport'
import { setEditorVisibleWorldCenter } from '../utils/editor-viewport-center'
import { getRuntimeCanvas, wakeRuntimeCanvasGl } from '../utils/runtime-canvas'
import { debugSceneLog } from '../utils/debug-scene-log'
import {
  commitEntityTransform,
  consumeRuntimeTransformEcho,
  type EntityTransformSnapshot,
} from '../utils/entity-transform-commit'
import { clearTransformPreview } from '../utils/transform-preview-store'
import {
  applyRuntimeCanvasPresentation,
  playStageAvailableSize,
  runtimeCanvasEditStyle,
  runtimeCanvasPlayStyle,
  RUNTIME_PLAY_STAGE_PADDING_PX,
  sceneBackgroundCss,
} from '../utils/runtime-canvas-presentation'
import {
  editorResizeSurface,
  editorSetEditorView,
  editorSyncPlaySurface,
  setTextureCacheEvictedCallback,
} from '../utils/wasm-bridge'
import { TilePaintOverlay } from './preview/TilePaintOverlay'
import { createTilemapForNewLayer, resolveTilemapTileSize } from '../types'

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
  const editorActiveLayerId = useEditorSelector((s) => s.editorActiveLayerId)
  const openScripts = useEditorSelector((s) => s.openScripts)
  const focusMode = useEditorSelector((s) => s.focusMode)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const editorGuidesVisible = useEditorSelector((s) => s.editorGuidesVisible)
  const editorRulerStep = useEditorSelector((s) => s.editorRulerStep)
  const editorRulersVisible = useEditorSelector((s) => s.editorRulersVisible)
  const projectLoadEpoch = useEditorSelector((s) => s.projectLoadEpoch)

  const canvasRef           = useRef<HTMLCanvasElement>(null)
  const canvasHostRef       = useRef<HTMLDivElement>(null)
  const [runtimeCanvasReady, setRuntimeCanvasReady] = useState(false)
  const viewportRef         = useRef<HTMLDivElement>(null)
  const playStageRef        = useRef<HTMLDivElement>(null)
  const [playStageSize, setPlayStageSize] = useState<{ x: number; y: number } | null>(null)
  const sceneIdRef          = useRef<string>('')
  const projectRef          = useRef(project)
  const projectPathRef      = useRef(projectPath)
  const snapToGridRef       = useRef(false)
  const gridSizeRef         = useRef(32)
  const ignoredTransformEchoRef = useRef<EntityTransformSnapshot | null>(null)
  const sceneViewportCenterKeyRef = useRef<string | null>(null)
  const bootSyncRef = useBootSyncRef()
  const useDockedRuntimePreview = isPlaying && !isTauri()

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
    isPlaying: useDockedRuntimePreview,
  }

  const makeLogEntry = makeRuntimeLogEntry

  const tier = useLayoutTier()
  const showInspectorToggle = tier !== 'full'
  const showExplorerToggle = tier === 'minimal' || tier === 'unsupported'

  const { wasmReady, engineReady, bootProjectSynced, syncWasmFromBridge } = useRuntimeReadiness()
  const syncRuntimeUiFlags = useCallback(() => {
    syncWasmFromBridge()
  }, [syncWasmFromBridge])

  function handleRuntimeTransform(
    entityId: number, x: number, y: number,
    rotation: number, scaleX: number, scaleY: number,
  ) {
    const incoming: EntityTransformSnapshot = {
      entityId, x, y, rotation, scaleX, scaleY,
    }
    if (consumeRuntimeTransformEcho(ignoredTransformEchoRef, incoming)) {
      return
    }

    commitEntityTransform({
      dispatch,
      snapshot: incoming,
      source: 'canvas',
      snapToGrid: snapToGridRef.current,
      gridSize: gridSizeRef.current,
      ignoreRuntimeEchoRef: ignoredTransformEchoRef,
    })
    clearTransformPreview(entityId)
  }

  // Adopt the singleton runtime canvas (see utils/runtime-canvas.ts). The
  // engine's GL context is bound to that one element forever, so the panel
  // re-parents it instead of letting React mint a new <canvas> per mount —
  // a fresh element would never receive a frame.
  useLayoutEffect(() => {
    const canvas = getRuntimeCanvas()
    canvasRef.current = canvas
    canvasHostRef.current?.appendChild(canvas)
    wakeRuntimeCanvasGl(canvas)
    setRuntimeCanvasReady(true)
    return () => {
      canvas.remove()
      if (canvasRef.current === canvas) canvasRef.current = null
      setRuntimeCanvasReady(false)
    }
  }, [])

  useLayoutEffect(() => {
    if (!runtimeCanvasReady) return
    const host = canvasHostRef.current
    if (!host) return
    const canvas = getRuntimeCanvas()
    if (canvas.parentElement !== host) host.appendChild(canvas)
  }, [useDockedRuntimePreview, runtimeCanvasReady])

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
    isPlaying: useDockedRuntimePreview,
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
    isPlaying: useDockedRuntimePreview,
    selectedEntityId: selection.entityId,
    selectedEntityIds: selection.entityIds,
    tool: activeTool,
    activeTileLayer: editorActiveLayerId,
    // Guides/grid are drawn by the runtime grid pass (native + WASM).
    guides: editorGuidesVisible,
    gridSize: editorGridSize,
    snapToGrid,
  })

  const selectedSceneId = selection.sceneId ?? project?.activeSceneId
  const selectedScene = project && selectedSceneId ? project.scenes?.[selectedSceneId] : undefined
  const paintTilemap = useMemo(() => {
    if (!selectedScene || !project) return undefined
    const layerTm = selectedScene.tilemapLayers?.[editorActiveLayerId]
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
  }, [selectedScene, editorActiveLayerId, activePaintTilesetId, project])
  const res = selectedScene?.worldSize ?? DEFAULT_SCENE_SIZE
  const vp  = selectedScene?.viewportSize ?? res
  const zoom = editorZoom

  // During play the engine applies ViewportPolicy::NativePlay: the canvas is
  // resized to the scene viewport (the camera lens), not the world. The frame
  // and canvas presentation must follow, or the engine-resized canvas sits
  // unscaled in the corner of a world-sized frame.
  const frame = useDockedRuntimePreview ? vp : res

  const preview = !useDockedRuntimePreview && cameraPreview && (vp.x !== res.x || vp.y !== res.y)
  const showCameraFrame = preview && mode === 'canvas' && (vp.x < res.x || vp.y < res.y)
  const editorCameraView = useEditorCameraView()
  const presentationSnapshot = usePresentationSnapshot()

  useEffect(() => {
    sceneViewportCenterKeyRef.current = null
  }, [selectedSceneId, projectLoadEpoch])

  const rulerMetrics = useMemo(
    () => buildEditorRulerMetrics({
      presentationSnapshot,
      fallbackZoom: zoom,
      rulerStep: editorRulerStep,
      worldSize: frame,
    }),
    [presentationSnapshot, zoom, editorRulerStep, frame.x, frame.y],
  )

  useLayoutEffect(() => {
    if (useDockedRuntimePreview) return undefined
    const el = viewportRef.current
    if (!el) return undefined
    const publish = () => {
      const center = presentationSnapshot?.visibleWorldBounds
        ? visibleWorldCenterFromSnapshot(presentationSnapshot)
        : visibleWorldCenterFromCamera(
          { x: editorCameraView.x, y: editorCameraView.y },
          el.clientWidth,
          el.clientHeight,
          zoom,
        )
      setEditorVisibleWorldCenter(center)
    }
    publish()
    const ro = new ResizeObserver(() => publish())
    ro.observe(el)
    return () => {
      ro.disconnect()
      setEditorVisibleWorldCenter(null)
    }
  }, [
    useDockedRuntimePreview,
    presentationSnapshot,
    editorCameraView.x,
    editorCameraView.y,
    zoom,
    selectedSceneId,
  ])

  useLayoutEffect(() => {
    if (!useDockedRuntimePreview) return undefined
    const el = playStageRef.current
    if (!el) return undefined
    const measure = () => setPlayStageSize((prev) =>
      prev && prev.x === el.clientWidth && prev.y === el.clientHeight
        ? prev
        : { x: el.clientWidth, y: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const focusFrame = requestAnimationFrame(() => el.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(focusFrame)
      ro.disconnect()
    }
  }, [useDockedRuntimePreview])

  useEditorFitZoom({
    viewportRef,
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
    viewportRef,
    zoom,
    dispatch,
    isPlaying: useDockedRuntimePreview,
    activeTool,
  })

  const bgColor = sceneBackgroundCss(selectedScene?.backgroundColor, 'var(--bg)')
  const playSnapshotReady =
    presentationSnapshot !== null
    && presentationSnapshot.revision > 0n
    && presentationSnapshot.effectiveMode === 'playEmbedded'

  const playStage = {
    x: playStageSize?.x ?? frame.x,
    y: playStageSize?.y ?? frame.y,
  }
  const playHostSize = useMemo(
    () => playStageAvailableSize(playStage, RUNTIME_PLAY_STAGE_PADDING_PX),
    [playStage.x, playStage.y],
  )

  // The runtime canvas is a persistent DOM node React does not manage, so its
  // presentation is applied imperatively via runtime-canvas-presentation.
  const applyCanvasPresentation = useCallback(() => {
    const canvas = getRuntimeCanvas()
    const pointerEvents = useDockedRuntimePreview || !panActive ? 'auto' : 'none'
    if (useDockedRuntimePreview) {
      applyRuntimeCanvasPresentation(canvas, {
        ...runtimeCanvasPlayStyle({
          hostSize: playHostSize,
          background: bgColor,
          layout: 'docked-top-left',
          pointerEvents,
        }),
        visibility: playSnapshotReady ? 'visible' : 'hidden',
      })
      return
    }
    const el = viewportRef.current
    const pad = rulerMetrics.paddingPx
    const cssW = el ? Math.max(1, el.clientWidth - pad * 2) : frame.x
    const cssH = el ? Math.max(1, el.clientHeight - pad * 2) : frame.y
    applyRuntimeCanvasPresentation(canvas, runtimeCanvasEditStyle({
      cssWidth: cssW,
      cssHeight: cssH,
      background: bgColor,
      pointerEvents,
    }))
  }, [
    useDockedRuntimePreview,
    frame.x,
    frame.y,
    playHostSize,
    bgColor,
    panActive,
    rulerMetrics.paddingPx,
    playSnapshotReady,
  ])

  useLayoutEffect(() => {
    applyCanvasPresentation()
  }, [applyCanvasPresentation])

  useLayoutEffect(() => {
    if (!useDockedRuntimePreview) return
    const dpr = window.devicePixelRatio || 1
    editorSyncPlaySurface(playHostSize.x, playHostSize.y, dpr)
  }, [useDockedRuntimePreview, playHostSize.x, playHostSize.y])

  const syncEditorSurface = useCallback((opts?: { center?: boolean }) => {
    const el = viewportRef.current
    const apiReady = runtimeSync.isEngineReady()
    if (!el || useDockedRuntimePreview || !apiReady) {
      // #region agent log
      debugSceneLog('PreviewPanel.tsx:syncEditorSurface', 'surface_sync_skipped', {
        hasEl: !!el,
        useDockedRuntimePreview,
        apiReady,
      }, 'H3')
      // #endregion
      return
    }
    const dpr = window.devicePixelRatio || 1
    const pad = rulerMetrics.paddingPx
    const cssW = Math.max(1, el.clientWidth - pad * 2)
    const cssH = Math.max(1, el.clientHeight - pad * 2)
    const fbW = Math.round(cssW * dpr)
    const fbH = Math.round(cssH * dpr)
    editorResizeSurface(cssW, cssH, dpr)
    const canvas = getRuntimeCanvas()
    wakeRuntimeCanvasGl(canvas)
    // #region agent log
    debugSceneLog('PreviewPanel.tsx:syncEditorSurface', 'surface_sync_applied', {
      cssW,
      cssH,
      fbW,
      fbH,
      canvasW: canvas.width,
      canvasH: canvas.height,
      clientW: canvas.clientWidth,
      clientH: canvas.clientHeight,
      connected: canvas.isConnected,
      parentTag: canvas.parentElement?.tagName ?? null,
    }, 'H2')
    // #endregion
    applyCanvasPresentation()
    if (
      opts?.center
      && selectedSceneId
      && selection.entityId == null
    ) {
      const centerKey = `${projectLoadEpoch}:${selectedSceneId}`
      if (sceneViewportCenterKeyRef.current !== centerKey) {
        sceneViewportCenterKeyRef.current = centerKey
        editorCenterSceneViewport(vp, cssW, cssH, zoom, dpr)
      }
    }
  }, [
    useDockedRuntimePreview,
    engineReady,
    wasmReady,
    rulerMetrics.paddingPx,
    applyCanvasPresentation,
    selectedSceneId,
    selection.entityId,
    projectLoadEpoch,
    vp.x,
    vp.y,
    zoom,
  ])

  useEffect(() => {
    return runtimeSync.onEngineReadyChange((ready) => {
      if (!ready || useDockedRuntimePreview) return
      syncEditorSurface({ center: true })
    })
  }, [useDockedRuntimePreview, syncEditorSurface])

  useEffect(() => {
    if (useDockedRuntimePreview || !runtimeSync.isEngineReady() || !selectedSceneId) return
    if (selection.entityId != null) return
    syncEditorSurface({ center: true })
  }, [
    useDockedRuntimePreview,
    engineReady,
    selectedSceneId,
    projectLoadEpoch,
    selection.entityId,
    syncEditorSurface,
  ])

  useEffect(() => {
    if (useDockedRuntimePreview || !engineReady) return
    const dpr = window.devicePixelRatio || 1
    const zDevice = zoom * dpr
    if (Math.abs(editorCameraView.zoomDevice - zDevice) < 1e-4) return
    editorSetEditorView(editorCameraView.x, editorCameraView.y, zDevice)
    applyCanvasPresentation()
  }, [zoom, useDockedRuntimePreview, engineReady, applyCanvasPresentation, editorCameraView.x, editorCameraView.y, editorCameraView.zoomDevice])

  useEffect(() => {
    let raf: number | null = null
    const unsubscribe = runtimeSync.onProjectReloadApplied(() => {
      if (useDockedRuntimePreview) return
      if (raf != null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = null
        syncEditorSurface()
      })
    })
    return () => {
      unsubscribe()
      if (raf != null) cancelAnimationFrame(raf)
    }
  }, [useDockedRuntimePreview, syncEditorSurface])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || useDockedRuntimePreview) return
    const syncIfReady = () => {
      if (runtimeSync.isEngineReady()) syncEditorSurface()
    }
    syncIfReady()
    const ro = new ResizeObserver(() => syncIfReady())
    ro.observe(el)
    return () => ro.disconnect()
  }, [useDockedRuntimePreview, syncEditorSurface, res.x, res.y, vp.x, vp.y, selectedSceneId])

  const frameSelection = useCallback(() => {
    const el = viewportRef.current
    if (!el || useDockedRuntimePreview) return
    const entityId = selection.entityId
    const def = entityId != null ? project?.entities?.[entityId] : null
    const dpr = window.devicePixelRatio || 1
    if (!def) {
      editorFrameWorld(0, 0, frame.x, frame.y, dispatch, dpr)
      return
    }
    editorFrameSelectionEntity(def.transform.position, def.transform.scale, dispatch, dpr)
  }, [useDockedRuntimePreview, selection.entityId, project, frame.x, frame.y, dispatch])

  useLayoutEffect(() => frameSelectionRegistry.register(frameSelection), [frameSelection])

  // Drag the camera rectangle's handle to set the scene's initial camera
  // position. The reducer clamps to the world; the runtime honours it at play.
  const onCameraStartDrag = useCallback((world: { x: number; y: number }) => {
    if (!selectedSceneId) return
    dispatch({ type: 'SCENE_SET_CAMERA_START', sceneId: selectedSceneId, x: world.x, y: world.y })
  }, [selectedSceneId, dispatch])

  // Suppress the browser context menu during play (right click is game input).
  useEffect(() => {
    if (!useDockedRuntimePreview) return
    const canvas = getRuntimeCanvas()
    const block = (e: Event) => e.preventDefault()
    canvas.addEventListener('contextmenu', block)
    return () => canvas.removeEventListener('contextmenu', block)
  }, [useDockedRuntimePreview])

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
              <RuntimeStatusBadge
                wasmReady={wasmReady}
                hasProject={!!project}
                projectSynced={bootProjectSynced}
                compact={showInspectorToggle}
              />
            </div>
          )}
        />
      )}

      {useDockedRuntimePreview ? (
        <div
          ref={playStageRef}
          tabIndex={-1}
          className="runtime-play-stage flex-1 min-h-0 min-w-0 outline-none"
        >
          <div
            className="runtime-play-host"
            style={{
              width: `${playHostSize.x}px`,
              height: `${playHostSize.y}px`,
            }}
          >
            <div ref={canvasHostRef} className="absolute inset-0 w-full h-full overflow-hidden" />
          </div>
        </div>
      ) : (
      <CanvasViewportWithRulers
        viewportRef={viewportRef}
        rulerMetrics={rulerMetrics}
        rulersVisible={editorRulersVisible}
        onWheel={handleWheel}
        onPointerDown={onCanvasAreaPointerDown}
        onPointerMove={onCanvasAreaPointerMove}
        onPointerUp={onCanvasAreaPointerUp}
        onPointerCancel={onCanvasAreaPointerUp}
        style={{ cursor: panCursor }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div ref={canvasHostRef} className="absolute inset-0 w-full h-full overflow-hidden" />
          {activePaintTilesetId && !useDockedRuntimePreview && (
            <TilePaintOverlay
              tilemap={paintTilemap}
              activeLayerId={editorActiveLayerId}
              selectedTileCell={selectedTileCell}
              sceneId={selectedSceneId ?? ''}
              paintTilesetAssetId={activePaintTilesetId}
              dispatch={dispatch}
            />
          )}
          {showCameraFrame && (
            <CameraFrameOverlay
              worldSize={res}
              viewportSize={vp}
              zoom={zoom}
              fillFrame={preview}
              cameraStart={selectedScene?.cameraStart}
              cameraWorldOrigin={{ x: editorCameraView.x, y: editorCameraView.y }}
              onCameraStartDrag={onCameraStartDrag}
            />
          )}
        </div>
      </CanvasViewportWithRulers>
      )}
    </div>
  )
}
