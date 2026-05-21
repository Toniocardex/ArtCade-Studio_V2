import { useRef, useLayoutEffect, useState } from 'react'
import { MousePointer2, Hand, Pencil, Eraser, Wifi, WifiOff, Grid3x3, ImageIcon } from 'lucide-react'
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

type Tool = EditorTool

function snapToGridValue(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value
}

function sameTransform(
  a: { entityId: number; x: number; y: number; rotation: number; scaleX: number; scaleY: number },
  b: { entityId: number; x: number; y: number; rotation: number; scaleX: number; scaleY: number },
): boolean {
  const epsilon = 0.0001
  return a.entityId === b.entityId &&
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.rotation - b.rotation) < epsilon &&
    Math.abs(a.scaleX - b.scaleX) < epsilon &&
    Math.abs(a.scaleY - b.scaleY) < epsilon
}

export default function PreviewPanel() {
  // ── IMPORTANT: useEditor() subscribes ONLY to CoreContext (project,
  // selection, isPlaying).  It does NOT subscribe to VolatileContext
  // (consoleLogs, cursorPos), so this component is NOT re-rendered on every
  // debug.log() call from Lua.
  //
  // Re-rendering PreviewPanel during Emscripten's rAF callback (triggered by
  // LOG dispatch) causes React DOM reconciliation to run while WebGL is
  // compositing its frame → one-frame flash visible as the canvas border and
  // content briefly disappearing.  The context split in editor-store.tsx
  // prevents this entirely.
  const { state, dispatch } = useEditor()
  const {
    project, projectPath, isPlaying, selection, selectedTileCell, mode,
    editorGridSize, snapToGrid,
  } = state

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const registeredAssetsRef   = useRef<Set<string>>(new Set())
  // current scene id for the (mount-time) onTilemapPainted callback
  const sceneIdRef = useRef<string>('')
  const snapToGridRef = useRef(false)
  const gridSizeRef = useRef(32)
  const ignoredTransformEchoRef = useRef<{
    entityId: number
    x: number
    y: number
    rotation: number
    scaleX: number
    scaleY: number
  } | null>(null)
  sceneIdRef.current = selection.sceneId ?? project?.activeSceneId ?? ''
  snapToGridRef.current = snapToGrid ?? false
  gridSizeRef.current = editorGridSize ?? 32
  const [wasmReady,  setWasmReady]  = useState(() => isReady())
  const [engineReady, setEngineReady] = useState(() => isReady())
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [showEditorGuides, setShowEditorGuides] = useState(true)

  /** UI must reflect the window singleton (StrictMode/HMR can skip onReady). */
  const syncRuntimeUiFlags = () => {
    if (!isReady()) return
    setWasmReady(true)
    setEngineReady(true)
  }

  function handleRuntimeTransform(
    entityId: number,
    x: number,
    y: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
  ) {
    const incoming = { entityId, x, y, rotation, scaleX, scaleY }
    if (ignoredTransformEchoRef.current && sameTransform(ignoredTransformEchoRef.current, incoming)) {
      ignoredTransformEchoRef.current = null
      return
    }

    const nextX = snapToGridRef.current ? snapToGridValue(x, gridSizeRef.current) : x
    const nextY = snapToGridRef.current ? snapToGridValue(y, gridSizeRef.current) : y
    const snapped = { entityId, x: nextX, y: nextY, rotation, scaleX, scaleY }

    if (snapToGridRef.current && (nextX !== x || nextY !== y)) {
      ignoredTransformEchoRef.current = snapped
      runtimeSync.syncEntityTransform(snapped)
    } else {
      // Mark this value as already in sync so a later React-side edit at the
      // same position doesn't bounce back to the runtime unnecessarily.
      runtimeSync.noteTransform(snapped)
    }
    dispatch({
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId,
      x: nextX,
      y: nextY,
      rotation,
      scaleX,
      scaleY,
    })
  }

  useLayoutEffect(() => {
    syncRuntimeUiFlags()
  })

  // Runtime lifecycle (mount + canvas rebind on view toggle).
  useWasmRuntimeLifecycle({
    canvasRef, mode, dispatch, setEngineReady,
    sceneIdRef, syncRuntimeUiFlags, handleRuntimeTransform,
    makeLogEntry,
  })

  // Push ProjectDoc into C++ whenever a runtime-affecting field changes.
  useRuntimeProjectSync({
    project, projectPath,
    selectionSceneId: selection.sceneId,
    wasmReady, engineReady,
  })

  // Push the persistent image library into the C++ texture cache.
  useRuntimeAssetUpload({
    project, projectPath, wasmReady, engineReady,
    registeredAssetsRef,
  })

  // Drive every per-frame editor channel (mode, selection, tool, chrome).
  // All these calls funnel through RuntimeSyncService so there is exactly one
  // place that owns the "what reaches the runtime, when?" contract.
  useRuntimeEditorSync({
    wasmReady, engineReady,
    isPlaying,
    selectedEntityId: selection.entityId,
    tool: activeTool,
    selectedTileCell,
    guides: showEditorGuides,
    gridSize: editorGridSize ?? 32,
  })

  // ── Canvas resolution matches game resolution ─────────────────────────────
  const res = project?.gameResolution ?? { x: 1280, y: 720 }
  const selectedSceneId = selection.sceneId ?? project?.activeSceneId
  const selectedScene = project && selectedSceneId ? project.scenes[selectedSceneId] : undefined

  // Background colour while WASM has not yet painted (prevents white flash).
  const bgColor = (() => {
    const sceneId = selection.sceneId ?? project?.activeSceneId
    const bg = project && sceneId ? project.scenes[sceneId]?.backgroundColor : undefined
    return bg
      ? `rgb(${Math.round(bg.x * 255)},${Math.round(bg.y * 255)},${Math.round(bg.z * 255)})`
      : 'var(--bg)'
  })()

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] relative">

      {/* ── Tool palette (React overlay, Z above canvas) ── */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-40
                      bg-[var(--panel)] p-2 border border-[var(--border)] rounded-lg shadow-lg">
        {([
          { id: 'select', Icon: MousePointer2, color: 'var(--accent)', title: 'Select / move entities' },
          { id: 'pan',    Icon: Hand,           color: 'var(--muted)',  title: 'Pan camera' },
        ] as const).map(({ id, Icon, color, title }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            title={title}
            className={`p-1.5 rounded transition-colors ${
              activeTool === id ? 'bg-[rgb(var(--accent-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
            }`}
          >
            <Icon size={15} color={activeTool === id ? color : 'var(--muted)'} />
          </button>
        ))}

        <div className="h-px w-full bg-[var(--border)]" />

        {([
          { id: 'paint', Icon: Pencil, title: 'Paint tiles' },
          { id: 'erase', Icon: Eraser, title: 'Erase tiles' },
        ] as const).map(({ id, Icon, title }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            title={title}
            className={`p-1.5 rounded transition-colors ${
              activeTool === id ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
            }`}
          >
            <Icon size={15} color={activeTool === id ? 'var(--accent-2)' : 'var(--muted)'} />
          </button>
        ))}

        <div className="h-px w-full bg-[var(--border)]" />

        {/* Phase F2: in-scene tile painting */}
        <button
          onClick={() => setActiveTool('tile')}
          title={`Paint selected tileset cell ${selectedTileCell === 0 ? '(empty)' : '#' + selectedTileCell}`}
          className={`p-1.5 rounded transition-colors ${
            activeTool === 'tile' ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
          }`}
        >
          <ImageIcon size={15} color={activeTool === 'tile' ? 'var(--accent-2)' : 'var(--muted)'} />
        </button>

        <div className="h-px w-full bg-[var(--border)]" />

        <button
          onClick={() => setShowEditorGuides(v => !v)}
          title="Toggle editor guides"
          className={`p-1.5 rounded transition-colors ${
            showEditorGuides ? 'bg-[rgb(var(--accent-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
          }`}
        >
          <Grid3x3 size={15} color={showEditorGuides ? 'var(--accent)' : 'var(--muted)'} />
        </button>
      </div>

      {/* ── WASM status badge ── */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5
                      bg-[var(--panel)] px-2 py-1 rounded-lg border border-[var(--border)] shadow-lg text-[9px]">
        {wasmReady
          ? <><Wifi size={10} className="text-[var(--accent)]" /><span className="text-[var(--accent)]">RUNTIME READY</span></>
          : <><WifiOff size={10} className="text-[var(--muted)]" /><span className="text-[var(--muted)]">
              {project ? 'LOADING…' : 'NO PROJECT'}
            </span></>
        }
      </div>

      {/* ── Viewport area ── */}
      {/*
        flex-1 + items-center + justify-center centres the canvas both
        horizontally and vertically within the available space.
        overflow-hidden clips any edge case where the canvas calculation
        is slightly off due to browser rounding.
      */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-6">
        {/*
          The C++ WASM runtime renders directly into this canvas.
          Emscripten targets it via window.Module.canvas (see wasm-bridge.ts).

          Sizing strategy:
          - width/height HTML attrs set the WebGL pixel resolution (1280×720).
          - CSS maxWidth + maxHeight + aspectRatio let the browser scale the
            canvas DOWN to fit the flex container while preserving the 16:9
            ratio exactly.  Without aspectRatio, maxWidth alone constrains
            the CSS width but leaves the height at its intrinsic 720px →
            canvas overflows the container → overflow-hidden clips it from
            the top → viewport appears off-centre.
        */}
        <canvas
          ref={canvasRef}
          id="artcade-canvas"
          width={res.x}
          height={res.y}
          className="border border-[var(--border)] shadow-2xl"
          style={{
            display:     'block',
            maxWidth:    '100%',
            maxHeight:   '100%',
            aspectRatio: `${res.x} / ${res.y}`,
            background:  bgColor,
          }}
        />

        {/* Preview metrics badge */}
        <div className="absolute bottom-8 right-8 text-[9px] text-[var(--muted)]
                        bg-[var(--panel)] border border-[var(--border)] rounded px-1.5 py-0.5
                        select-none pointer-events-none text-right leading-tight">
          <div>Output {res.x}x{res.y}</div>
          {selectedScene && (
            <>
              <div>Scene {selectedScene.worldSize.x}x{selectedScene.worldSize.y}</div>
              <div>Viewport {selectedScene.viewportSize.x}x{selectedScene.viewportSize.y}</div>
            </>
          )}
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
