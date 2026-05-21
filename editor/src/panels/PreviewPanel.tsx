import { useEffect, useRef, useLayoutEffect, useState } from 'react'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import { isReady } from '../utils/wasm-bridge'
import { runtimeSync, type EditorTool } from '../utils/runtime-sync-service'
import {
  useWasmRuntimeLifecycle,
  useRuntimeProjectSync,
  useRuntimeAssetUpload,
  useRuntimeEditorSync,
} from './preview/runtime-hooks'
import { CanvasToolbar } from './preview/CanvasToolbar'
import { RuntimeStatusBadge } from './preview/RuntimeStatusBadge'

type TransformSnapshot = {
  entityId: number
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

function snapToGridValue(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value
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
    editorGridSize, snapToGrid, editorZoom,
  } = state

  const canvasRef           = useRef<HTMLCanvasElement>(null)
  const scrollRef           = useRef<HTMLDivElement>(null)
  const registeredAssetsRef = useRef<Set<string>>(new Set())
  const sceneIdRef          = useRef<string>('')
  const snapToGridRef       = useRef(false)
  const gridSizeRef         = useRef(32)
  const ignoredTransformEchoRef = useRef<TransformSnapshot | null>(null)

  sceneIdRef.current    = selection.sceneId ?? project?.activeSceneId ?? ''
  snapToGridRef.current = snapToGrid ?? false
  gridSizeRef.current   = editorGridSize ?? 32

  const [wasmReady,   setWasmReady]        = useState(() => isReady())
  const [engineReady, setEngineReady]      = useState(() => isReady())
  const [activeTool,  setActiveTool]       = useState<EditorTool>('select')
  const [showEditorGuides, setShowEditorGuides] = useState(true)

  /** UI must reflect the window singleton (StrictMode/HMR can skip onReady). */
  const syncRuntimeUiFlags = () => {
    if (!isReady()) return
    setWasmReady(true)
    setEngineReady(true)
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

    const nextX = snapToGridRef.current ? snapToGridValue(x, gridSizeRef.current) : x
    const nextY = snapToGridRef.current ? snapToGridValue(y, gridSizeRef.current) : y
    const snapped: TransformSnapshot = { entityId, x: nextX, y: nextY, rotation, scaleX, scaleY }

    if (snapToGridRef.current && (nextX !== x || nextY !== y)) {
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
    project, projectPath,
    selectionSceneId: selection.sceneId,
    wasmReady, engineReady,
  })

  useRuntimeAssetUpload({
    project, projectPath, wasmReady, engineReady,
    registeredAssetsRef,
  })

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
    gridSize: editorGridSize ?? 32,
  })

  const selectedSceneId = selection.sceneId ?? project?.activeSceneId
  const selectedScene = project && selectedSceneId ? project.scenes[selectedSceneId] : undefined
  // The editor canvas matches the SCENE worldSize (the playable level).
  // Long levels (e.g. 4096x640 platformer) → the surrounding container has
  // overflow:auto so scrollbars appear; the pan tool still works for camera
  // dragging. viewportSize is drawn as an amber overlay by the C++
  // editor-overlay-renderer.
  const res = selectedScene?.worldSize ?? { x: 1280, y: 720 }
  const zoom = editorZoom ?? 1.0
  const scaledW = Math.round(res.x * zoom)
  const scaledH = Math.round(res.y * zoom)

  // Compute fit-to-panel zoom: largest scale where the world fits inside the
  // visible scroll container, clamped to the EDITOR_SET_ZOOM reducer range.
  function computeFitZoom(): number {
    const el = scrollRef.current
    if (!el) return 1.0
    const padding = 48 // matches the p-6 wrapper on each side
    const availW = Math.max(1, el.clientWidth  - padding)
    const availH = Math.max(1, el.clientHeight - padding)
    return Math.min(availW / res.x, availH / res.y)
  }

  function setZoom(next: number) {
    dispatch({ type: 'EDITOR_SET_ZOOM', zoom: next })
  }

  function fitZoom() {
    setZoom(computeFitZoom())
  }

  // Bridge for the Ctrl+9 keyboard shortcut owned by App.tsx — keeping the
  // fit math here means we have one source of truth for "what fits" without
  // hoisting scrollRef into App.tsx.
  useEffect(() => {
    function onFitEvent() { fitZoom() }
    window.addEventListener('artcade:zoom-fit', onFitEvent)
    return () => window.removeEventListener('artcade:zoom-fit', onFitEvent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.x, res.y])

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
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const nextZoom = Math.min(4.0, Math.max(0.1, zoom * factor))
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
        zoom={zoom}
        onSetZoom={setZoom}
        onFitZoom={fitZoom}
        rightSlot={<RuntimeStatusBadge wasmReady={wasmReady} hasProject={!!project} />}
      />

      {/* Viewport area.
          Scrollable wrapper: native scrollbars appear when the (zoomed) scene
          exceeds the panel; the inner flex centring keeps small scenes aligned
          when they fit. Ctrl+wheel zooms anchored at the cursor. */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 overflow-auto p-6"
      >
        <div className="min-w-full min-h-full flex items-center justify-center">
          {/* Sized wrapper = the visual footprint of the canvas at the current
              zoom. Layout uses this size for scrolling; the canvas inside is
              still at native worldSize and is visually scaled via CSS
              transform. The C++ input controller picks the correct mouse
              coords because it reads CSS-vs-internal canvas size at runtime. */}
          <div
            style={{
              width:    `${scaledW}px`,
              height:   `${scaledH}px`,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <canvas
              ref={canvasRef}
              id="artcade-canvas"
              width={res.x}
              height={res.y}
              className="border border-[var(--border)] shadow-2xl"
              style={{
                display:         'block',
                position:        'absolute',
                top:             0,
                left:            0,
                width:           `${res.x}px`,
                height:          `${res.y}px`,
                transform:       `scale(${zoom})`,
                transformOrigin: '0 0',
                background:      bgColor,
              }}
            />
          </div>
        </div>
      </div>
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
