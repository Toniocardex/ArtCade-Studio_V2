import { useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { assetOrchestrator } from '../utils/asset-orchestrator'
import { watchProjectAssets } from '../utils/asset-watcher'
import { dirName } from '../utils/project'
import {
  reloadProjectAudioAsset,
  reloadProjectFontAsset,
  reloadProjectImageAsset,
} from '../utils/reload-project-asset'
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
import { CanvasFooterBar } from './preview/CanvasFooterBar'
import { useLayoutTier } from '../contexts/editor-layout-tier-context'
import { InspectorDrawerToggle } from '../contexts/inspector-drawer-context'
import { useRuntimeReadiness } from '../hooks/useRuntimeReadiness'
import { useEditorCanvasViewport } from '../hooks/useEditorCanvasViewport'
import { useEditorFitZoom } from '../hooks/useEditorFitZoom'

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
  showEditorGuides: boolean
  onToggleGuides: () => void
  showToolPalette?: boolean
}>

export default function PreviewPanel({
  activeTool,
  onSelectTool,
  showEditorGuides,
  onToggleGuides,
  showToolPalette = true,
}: PreviewPanelProps) {
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
    openScripts, focusMode,
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

  const tier = useLayoutTier()
  const showInspectorToggle = tier !== 'full'

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

  // Mount-only: wasm-bridge onReady also calls syncRuntimeUiFlags; do not run
  // every render (causes "Maximum update depth exceeded").
  useLayoutEffect(() => {
    syncRuntimeUiFlags()
  }, [syncRuntimeUiFlags])

  useWasmRuntimeLifecycle({
    canvasRef, mode, dispatch,
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
  const res = selectedScene?.worldSize ?? DEFAULT_SCENE_SIZE
  const vp  = selectedScene?.viewportSize ?? res
  const zoom = editorZoom

  const preview = cameraPreview && (vp.x !== res.x || vp.y !== res.y)
  const showCameraFrame = !isPlaying && mode === 'canvas' && (vp.x < res.x || vp.y < res.y)
  const layout = useMemo(
    () => computeCanvasViewportLayout({
      worldSize: res,
      viewportSize: vp,
      zoom,
      preview,
    }),
    [res.x, res.y, vp.x, vp.y, zoom, preview],
  )
  const frameW = layout.contentSizePx.x
  const frameH = layout.contentSizePx.y
  const canvasDX = preview ? -Math.round(((res.x - vp.x) / 2) * zoom) : 0
  const canvasDY = preview ? -Math.round(((res.y - vp.y) / 2) * zoom) : 0

  useEditorFitZoom({
    scrollRef,
    dispatch,
    editorZoomMode,
    preview,
    sceneWidth: res.x,
    sceneHeight: res.y,
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

  return (
    <div className="editor-preview-island h-full flex flex-col bg-[var(--bg)]">
      {focusMode ? (
        <CanvasFocusToolbar />
      ) : (
          <CanvasToolbar
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            selectedTileCell={selectedTileCell}
            showGuides={showEditorGuides}
            onToggleGuides={onToggleGuides}
            showToolPalette={showToolPalette}
            rightSlot={(
            <div className="flex items-center gap-2 min-w-0">
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
        onWheel={handleWheel}
        onPointerDown={onCanvasAreaPointerDown}
        onPointerMove={onCanvasAreaPointerMove}
        onPointerUp={onCanvasAreaPointerUp}
        onPointerCancel={onCanvasAreaPointerUp}
        style={{ cursor: panCursor }}
      >
        <div
          className="w-fit h-fit shrink-0"
          style={{ width: frameW, height: frameH }}
        >
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
            <div className="canvas-scene-frame__edge" aria-hidden />
          </div>
        </div>
      </CanvasViewportWithRulers>

      {!focusMode && <CanvasFooterBar />}
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
