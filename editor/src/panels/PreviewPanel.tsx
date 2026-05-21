import { useRef, useLayoutEffect, useState } from 'react'
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
    editorGridSize, snapToGrid,
  } = state

  const canvasRef           = useRef<HTMLCanvasElement>(null)
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

  const res = project?.gameResolution ?? { x: 1280, y: 720 }
  const selectedSceneId = selection.sceneId ?? project?.activeSceneId
  const selectedScene = project && selectedSceneId ? project.scenes[selectedSceneId] : undefined

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
        rightSlot={<RuntimeStatusBadge wasmReady={wasmReady} hasProject={!!project} />}
      />

      {/* Viewport area:
        flex-1 + items-center + justify-center centres the canvas both
        horizontally and vertically. overflow-hidden clips any edge case
        where the canvas calculation is slightly off due to browser
        rounding. */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-6">
        {/* The C++ WASM runtime renders directly into this canvas. Emscripten
            targets it via window.Module.canvas (see wasm-bridge.ts).

            Sizing strategy:
              - width/height HTML attrs set the WebGL pixel resolution.
              - CSS maxWidth + maxHeight + aspectRatio let the browser scale
                the canvas DOWN while preserving the source ratio. Without
                aspectRatio, maxWidth alone constrains the CSS width but
                leaves the height at its intrinsic 720px, the canvas
                overflows the container, overflow-hidden clips it from the
                top, and the viewport appears off-centre. */}
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
