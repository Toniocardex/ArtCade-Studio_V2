import { useRef, useEffect, useState } from 'react'
import { MousePointer2, Hand, Paintbrush, Eraser, Wifi, WifiOff } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import {
  loadWasmRuntime, isReady,
  syncEditorRuntimeState,
} from '../utils/wasm-bridge'

// ---------------------------------------------------------------------------
// Where the WASM runtime lives (relative to the Tauri app root).
// In dev  → Vite serves from /public, so /runtime/game.js
// In prod → bundled as a Tauri asset at the same relative path
// ---------------------------------------------------------------------------
const WASM_RUNTIME_SRC = '/runtime/game.js'

type Tool = 'select' | 'pan' | 'paint' | 'erase'

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
  const { project, isPlaying, selection } = state

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [wasmReady,  setWasmReady]  = useState(() => isReady())
  const [engineReady, setEngineReady] = useState(false)
  const [activeTool, setActiveTool] = useState<Tool>('select')

  // ── Load WASM runtime once the canvas is mounted ─────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (isReady()) { setWasmReady(true); return }

    loadWasmRuntime(canvas, WASM_RUNTIME_SRC, {
      onReady: () => {
        setWasmReady(true)

        // Defer LOG dispatch out of the onRuntimeInitialized callback so that
        // React reconciliation does not run synchronously inside the WASM
        // initialisation sequence.
        setTimeout(() => dispatch({
          type: 'LOG',
          entry: makeLogEntry('[WASM] Runtime initialised — editor mode active.', 'info'),
        }), 0)
      },

      onEntitySelected: (entityId) => {
        dispatch({ type: 'SELECT_ENTITY', entityId })
      },

      onEntityTransformChanged: (entityId, x, y, rotation, scaleX, scaleY) => {
        setTimeout(() => dispatch({
          type: 'UPDATE_ENTITY_TRANSFORM',
          entityId,
          x,
          y,
          rotation,
          scaleX,
          scaleY,
        }), 0)
      },

      // debug.log() / engine logs → Console panel.
      //
      // CRITICAL: use setTimeout(0) to defer the React state update out of
      // Emscripten's requestAnimationFrame callback.  Without the deferral:
      //   rAF → emscripten main-loop → C++ luaHost.tick → debug.log →
      //   EM_ASM → window.onConsoleLine → dispatch(LOG) →
      //   React reconciliation ← happens DURING WebGL frame composition
      //   → browser compositor shows blank/partial frame = "coin pickup flash"
      //
      // With setTimeout(0) the dispatch is queued as a separate task that
      // runs AFTER the current rAF + browser paint completes, fully
      // decoupling React DOM updates from WebGL rendering.
      onConsoleLine: (message, level) => {
        const entry = makeLogEntry(message, level)
        if (message.includes('[EditorAPI] Bridge initialised')) {
          setTimeout(() => setEngineReady(true), 0)
        }
        setTimeout(() => dispatch({ type: 'LOG', entry }), 0)
      },
    })
  }, [dispatch])   // run once on mount

  // ── Re-sync project into C++ whenever the user opens a new project ────────
  useEffect(() => {
    if (!wasmReady || !engineReady || !project) return
    syncEditorRuntimeState({ projectJson: JSON.stringify(project) })
  }, [project, wasmReady, engineReady])

  // ── Sync play/edit mode to C++ ────────────────────────────────────────────
  useEffect(() => {
    if (!wasmReady || !engineReady) return
    syncEditorRuntimeState({ mode: isPlaying ? 1 : 0 })
  }, [isPlaying, wasmReady, engineReady])

  // ── Sync selected entity to C++ ──────────────────────────────────────────
  useEffect(() => {
    if (!wasmReady || !engineReady) return
    syncEditorRuntimeState({ selectedEntityId: selection.entityId })
  }, [selection.entityId, wasmReady, engineReady])

  // ── Canvas resolution matches game resolution ─────────────────────────────
  const res = project?.gameResolution ?? { x: 1280, y: 720 }

  // Background colour while WASM has not yet painted (prevents white flash).
  const bgColor = (() => {
    const sceneId = selection.sceneId ?? project?.activeSceneId
    const bg = project && sceneId ? project.scenes[sceneId]?.backgroundColor : undefined
    return bg
      ? `rgb(${Math.round(bg.x * 255)},${Math.round(bg.y * 255)},${Math.round(bg.z * 255)})`
      : '#0B1121'
  })()

  return (
    <div className="h-full flex flex-col bg-[#111827] relative">

      {/* ── Tool palette (React overlay, Z above canvas) ── */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-40
                      bg-[#0B1121]/90 p-2 border border-[#1A253A] rounded">
        {([
          { id: 'select', Icon: MousePointer2, color: '#00FFFF' },
          { id: 'pan',    Icon: Hand,           color: '#9CA3AF' },
        ] as const).map(({ id, Icon, color }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            className={`p-1.5 rounded transition-colors ${
              activeTool === id ? 'bg-[#00FFFF]/20' : 'hover:bg-white/5'
            }`}
          >
            <Icon size={15} color={activeTool === id ? color : '#9CA3AF'} />
          </button>
        ))}

        <div className="h-px w-full bg-[#1A253A]" />

        {([
          { id: 'paint', Icon: Paintbrush },
          { id: 'erase', Icon: Eraser     },
        ] as const).map(({ id, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            className={`p-1.5 rounded transition-colors ${
              activeTool === id ? 'bg-[#FF00FF]/20' : 'hover:bg-white/5'
            }`}
          >
            <Icon size={15} color={activeTool === id ? '#FF00FF' : '#9CA3AF'} />
          </button>
        ))}
      </div>

      {/* ── WASM status badge ── */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5
                      bg-[#0B1121]/90 px-2 py-1 rounded border border-[#1A253A] text-[9px]">
        {wasmReady
          ? <><Wifi size={10} className="text-[#00FFFF]" /><span className="text-[#00FFFF]">RUNTIME READY</span></>
          : <><WifiOff size={10} className="text-[#9CA3AF]" /><span className="text-[#9CA3AF]">
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
          className="border border-[#1A253A] shadow-2xl"
          style={{
            display:     'block',
            maxWidth:    '100%',
            maxHeight:   '100%',
            aspectRatio: `${res.x} / ${res.y}`,
            background:  bgColor,
          }}
        />

        {/* Resolution badge */}
        <div className="absolute bottom-8 right-8 text-[9px] text-[#1A253A]/80
                        bg-black/30 px-1 select-none pointer-events-none">
          {res.x}×{res.y}
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
