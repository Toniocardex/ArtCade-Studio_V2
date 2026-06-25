import { useRef, useLayoutEffect, useEffect, useCallback, useMemo, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { assetOrchestrator, imageAssetDescriptor } from '../utils/asset-orchestrator'
import { watchProjectAssets } from '../utils/asset-watcher'
import { dirName } from '../utils/project'
import { runtimeSync, type EditorTool } from '../utils/runtime-sync-service'
import {
  DEFAULT_SCENE_SIZE,
  EDITOR_CANVAS_OVERSCROLL_FACTOR,
  EDITOR_CANVAS_PADDING_PX,
} from '../constants/editor-viewport'
import {
  useWasmRuntimeLifecycle,
  useRuntimeProjectSync,
  useRuntimeAssetUpload,
  useRuntimeEditorSync,
} from './preview/runtime-hooks'
import { computeCanvasViewportLayout, scrollToWorld, worldToScroll } from '../utils/canvas-viewport-layout'
import { zoomFitRegistry } from '../utils/zoom-fit-registry'
import { frameSelectionRegistry } from '../utils/frame-selection-registry'
import { computeFrameSelectionView } from '../utils/frame-selection'
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
import {
  applyRuntimeCanvasPresentation,
  playDisplaySize,
  playFitScale,
  playStageAvailableSize,
  runtimeCanvasEditStyle,
  runtimeCanvasPlayStyle,
  RUNTIME_PLAY_MIN_SCALE,
  RUNTIME_PLAY_STAGE_PADDING_PX,
  sceneBackgroundCss,
} from '../utils/runtime-canvas-presentation'
import { editorSetEditCamera, editorSyncPlaySurface, setTextureCacheEvictedCallback } from '../utils/wasm-bridge'
import { TilePaintOverlay } from './preview/TilePaintOverlay'
import { createTilemapForNewLayer, resolveTilemapTileSize } from '../types'

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
  const editorActiveLayerId = useEditorSelector((s) => s.editorActiveLayerId)
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
  const playStageRef        = useRef<HTMLDivElement>(null)
  // Measured scroll-viewport size — drives scene centring + edge overscroll.
  const [clientSize, setClientSize] = useState<{ x: number; y: number } | null>(null)
  const [playStageSize, setPlayStageSize] = useState<{ x: number; y: number } | null>(null)
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
  const overscrollPx = clientSize
    ? Math.round(Math.min(clientSize.x, clientSize.y) * EDITOR_CANVAS_OVERSCROLL_FACTOR)
    : 0
  const layout = useMemo(
    () => computeCanvasViewportLayout({
      worldSize: frame,
      viewportSize: vp,
      zoom,
      preview,
      rulerStep: editorRulerStep,
      clientSize: clientSize ?? undefined,
      overscrollPx,
    }),
    [frame.x, frame.y, vp.x, vp.y, zoom, preview, editorRulerStep,
     clientSize?.x, clientSize?.y, overscrollPx],
  )
  const frameW = layout.contentSizePx.x
  const frameH = layout.contentSizePx.y
  // Offset of the scene frame from the scroll content origin. The scroll
  // container already pads by layout.paddingPx, so the spacer only needs the
  // extra (centring / overscroll) margin on top of that.
  const sceneMarginX = Math.max(0, layout.contentOffsetPx.x - layout.paddingPx)
  const sceneMarginY = Math.max(0, layout.contentOffsetPx.y - layout.paddingPx)

  // Track the scroll-viewport size so the layout can centre the scene and add
  // edge overscroll. In docked browser preview the scroll viewport unmounts
  // during Play, so this observer must follow the real node lifecycle instead
  // of staying attached to a detached element that can report 0x0.
  useLayoutEffect(() => {
    if (useDockedRuntimePreview) return undefined
    const el = scrollRef.current
    if (!el) return undefined
    const measure = () => {
      const width = el.clientWidth
      const height = el.clientHeight
      if (width <= 0 || height <= 0) return
      setClientSize((prev) =>
        prev && prev.x === width && prev.y === height
          ? prev
          : { x: width, y: height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [useDockedRuntimePreview])

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
    isPlaying: useDockedRuntimePreview,
    activeTool,
    clientSize,
    overscrollPx,
  })

  const bgColor = sceneBackgroundCss(selectedScene?.backgroundColor, 'var(--bg)')

  const playScale = (() => {
    if (!useDockedRuntimePreview) return zoom
    const stage = {
      x: playStageSize?.x ?? frame.x,
      y: playStageSize?.y ?? frame.y,
    }
    return playFitScale(
      { x: frame.x, y: frame.y },
      playStageAvailableSize(stage, RUNTIME_PLAY_STAGE_PADDING_PX),
      { minScale: RUNTIME_PLAY_MIN_SCALE },
    )
  })()

  const playHostSize = playDisplaySize({ x: frame.x, y: frame.y }, playScale)

  // The runtime canvas is a persistent DOM node React does not manage, so its
  // presentation is applied imperatively via runtime-canvas-presentation.
  const applyCanvasPresentation = useCallback(() => {
    const canvas = getRuntimeCanvas()
    const pointerEvents = useDockedRuntimePreview || !panActive ? 'auto' : 'none'
    if (useDockedRuntimePreview) {
      applyRuntimeCanvasPresentation(canvas, runtimeCanvasPlayStyle({
        viewport: { x: frame.x, y: frame.y },
        scale: playScale,
        background: bgColor,
        layout: 'docked-top-left',
        pointerEvents,
      }))
      return
    }
    const el = scrollRef.current
    const pad = layout.paddingPx
    const cssW = el ? Math.max(1, el.clientWidth - pad * 2) : frame.x
    const cssH = el ? Math.max(1, el.clientHeight - pad * 2) : frame.y
    applyRuntimeCanvasPresentation(canvas, runtimeCanvasEditStyle({
      cssWidth: cssW,
      cssHeight: cssH,
      background: bgColor,
      pointerEvents,
    }))
  }, [useDockedRuntimePreview, frame.x, frame.y, playScale, bgColor, panActive, layout.paddingPx])

  useLayoutEffect(() => {
    applyCanvasPresentation()
  }, [applyCanvasPresentation])

  useLayoutEffect(() => {
    if (!useDockedRuntimePreview) return
    editorSyncPlaySurface(Math.max(1, Math.round(frame.x)), Math.max(1, Math.round(frame.y)))
  }, [useDockedRuntimePreview, frame.x, frame.y])

  // Edit-mode preview camera: drive the runtime camera from the scroll
  // container so the world slice under the viewport is rendered at native
  // resolution. target = world point at the canvas top-left; zoom + viewport
  // in device px. Re-assert the CSS afterwards because setWindowSize (fired
  // only when the viewport px change) strips the inline canvas style on
  // Emscripten. The canvas sits `pad` in from the scroll edge, so the world
  // point at its corner = scrollToWorld(scroll, layout, {pad,pad}) — this
  // tracks the centring / overscroll offset baked into layout.contentOffsetPx
  // and keeps picking aligned (it collapses to scrollLeft/zoom when centred).
  const camSyncRafRef = useRef<number | null>(null)
  const syncEditCamera = useCallback(() => {
    const el = scrollRef.current
    if (!el || useDockedRuntimePreview || !engineReady) return
    const dpr = window.devicePixelRatio || 1
    const pad = layout.paddingPx
    const cssW = Math.max(1, el.clientWidth  - pad * 2)
    const cssH = Math.max(1, el.clientHeight - pad * 2)
    const z = zoom > 0 ? zoom : 1
    const target = scrollToWorld(el.scrollLeft, el.scrollTop, layout, { x: pad, y: pad })
    editorSetEditCamera(
      target.x, target.y,
      z * dpr, cssW * dpr, cssH * dpr,
    )
    applyCanvasPresentation()
  }, [useDockedRuntimePreview, engineReady, zoom, layout, applyCanvasPresentation])

  useEffect(() => {
    let raf: number | null = null
    const unsubscribe = runtimeSync.onProjectReloadApplied(() => {
      if (useDockedRuntimePreview) return
      if (raf != null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = null
        syncEditCamera()
      })
    })
    return () => {
      unsubscribe()
      if (raf != null) cancelAnimationFrame(raf)
    }
  }, [useDockedRuntimePreview, syncEditCamera])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || useDockedRuntimePreview || !engineReady) return
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
  }, [useDockedRuntimePreview, engineReady, syncEditCamera, res.x, res.y, vp.x, vp.y, selectedSceneId])

  // F = frame selected: zoom in on the selected entity and centre it; with no
  // selection, fall back to fit-the-whole-scene. Registered so useViewport
  // shortcuts can invoke it without reaching into the panel's scroll ref.
  const frameSelection = useCallback(() => {
    const el = scrollRef.current
    if (!el || useDockedRuntimePreview) return
    const entityId = selection.entityId
    const def = entityId != null ? project?.entities[entityId] : null
    if (!def) {
      zoomFitRegistry.invoke()
      return
    }
    const { zoom: nextZoom, center } = computeFrameSelectionView({
      position: def.transform.position,
      scale: def.transform.scale,
      clientW: el.clientWidth,
      clientH: el.clientHeight,
      paddingPx: EDITOR_CANVAS_PADDING_PX,
    })
    dispatch({ type: 'EDITOR_SET_ZOOM', zoom: nextZoom })
    const nextLayout = computeCanvasViewportLayout({
      worldSize: frame,
      viewportSize: vp,
      zoom: nextZoom,
      preview,
      clientSize: { x: el.clientWidth, y: el.clientHeight },
      overscrollPx,
    })
    requestAnimationFrame(() => {
      const node = scrollRef.current
      if (!node) return
      const { scrollLeft, scrollTop } = worldToScroll(center, nextLayout, {
        x: node.clientWidth * 0.5,
        y: node.clientHeight * 0.5,
      })
      const maxX = Math.max(0, node.scrollWidth - node.clientWidth)
      const maxY = Math.max(0, node.scrollHeight - node.clientHeight)
      node.scrollLeft = Math.min(maxX, Math.max(0, scrollLeft))
      node.scrollTop = Math.min(maxY, Math.max(0, scrollTop))
    })
  }, [useDockedRuntimePreview, selection.entityId, project, frame.x, frame.y, vp.x, vp.y, preview, overscrollPx, dispatch])

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
              <RuntimeStatusBadge wasmReady={wasmReady} hasProject={!!project} compact={showInspectorToggle} />
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
            <div ref={canvasHostRef} style={{ display: 'contents' }} />
          </div>
        </div>
      ) : (
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
          {activePaintTilesetId && !useDockedRuntimePreview && (
            <TilePaintOverlay
              scrollRef={scrollRef}
              zoom={zoom}
              tilemap={paintTilemap}
              activeLayerId={editorActiveLayerId}
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
          style={{
            width: frameW,
            height: frameH,
            margin: `${sceneMarginY}px ${sceneMarginX}px`,
            position: 'relative',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <div
            className="canvas-scene-frame"
            style={{
              width:     `${frameW}px`,
              height:    `${frameH}px`,
              boxShadow: preview ? '0 0 0 2px var(--accent)' : undefined,
            }}
          >
            {showCameraFrame && (
              <CameraFrameOverlay
                worldSize={res}
                viewportSize={vp}
                zoom={zoom}
                fillFrame={preview}
                cameraStart={selectedScene?.cameraStart}
                onCameraStartDrag={onCameraStartDrag}
              />
            )}
            <div className="canvas-scene-frame__edge" aria-hidden />
          </div>
        </div>
      </CanvasViewportWithRulers>
      )}
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
