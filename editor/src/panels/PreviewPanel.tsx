import { useRef, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { MousePointer2, Hand, Paintbrush, Eraser, Wifi, WifiOff } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import {
  loadWasmRuntime, editorSetMode,
  editorSelectEntity, editorDeselect,
  editorLoadProject, isReady,
} from '../utils/wasm-bridge'

// ---------------------------------------------------------------------------
// Where the WASM runtime lives (relative to the Tauri app root).
// In dev  → Vite serves from /public, so /runtime/game.js
// In prod → bundled as a Tauri asset at the same relative path
// ---------------------------------------------------------------------------
const WASM_RUNTIME_SRC = '/runtime/game.js'

type Tool = 'select' | 'pan' | 'paint' | 'erase'

export default function PreviewPanel() {
  const { state, dispatch } = useEditor()
  const { project, isPlaying, selection, projectPath } = state

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [wasmReady,  setWasmReady]  = useState(() => isReady())
  const [activeTool, setActiveTool] = useState<Tool>('select')

  // ── Load WASM runtime once the canvas is mounted ─────────────────────────
  // game.wasm self-loads its baked-in test-project; we then push the current
  // React project into the C++ engine via editorLoadProject so the viewport
  // reflects exactly what the Hierarchy/Inspector show.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (isReady()) { setWasmReady(true); return }

    loadWasmRuntime(canvas, WASM_RUNTIME_SRC, {
      onReady: () => {
        setWasmReady(true)
        // Push current project into C++ engine so it renders the same scene
        if (project) {
          editorLoadProject(JSON.stringify(project))
        }
        dispatch({
          type: 'LOG',
          entry: {
            id:      Date.now(),
            time:    new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            message: '[WASM] Runtime initialised — editor mode active.',
            level:   'info',
          },
        })
      },

      // C++ clicked an entity in the viewport → sync React selection
      onEntitySelected: (entityId) => {
        dispatch({ type: 'SELECT_ENTITY', entityId })
      },

      // C++ finished a gizmo drag → log for now; Inspector will update
      // in a future phase when InspectorPanel subscribes to this
      onEntityTransformChanged: (_id, _x, _y, _rot, _sx, _sy) => {
        // Phase 21: dispatch UPDATE_ENTITY_TRANSFORM
      },

      // debug.log() / engine logs forwarded to Console panel
      onConsoleLine: (message, level) => {
        dispatch({
          type: 'LOG',
          entry: {
            id:      Date.now() + Math.random(),
            time:    new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            message,
            level:   (['info', 'warn', 'error', 'lua'] as const).includes(level as never)
                       ? (level as 'info' | 'warn' | 'error' | 'lua')
                       : 'info',
          },
        })
      },
    })
  }, [dispatch])   // run once on mount — WASM loads regardless of projectPath

  // ── Re-sync project into C++ whenever the user opens a new project ────────
  useEffect(() => {
    if (!wasmReady || !project) return
    editorLoadProject(JSON.stringify(project))
  }, [project, wasmReady])

  // ── Sync play/edit mode to C++ ────────────────────────────────────────────
  useEffect(() => {
    if (!wasmReady) return
    editorSetMode(isPlaying ? 1 : 0)
  }, [isPlaying, wasmReady])

  // ── Sync selected entity to C++ ──────────────────────────────────────────
  useEffect(() => {
    if (!wasmReady) return
    if (selection.entityId != null) editorSelectEntity(selection.entityId)
    else editorDeselect()
  }, [selection.entityId, wasmReady])

  // ── Canvas resolution matches game resolution ─────────────────────────────
  const res = project?.gameResolution ?? { x: 1280, y: 720 }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    dispatch({
      type: 'SET_CURSOR',
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    })
  }

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
              {projectPath ? 'LOADING…' : 'NO PROJECT'}
            </span></>
        }
      </div>

      {/* ── Viewport area ── */}
      <div
        className="flex-1 relative flex items-center justify-center p-6"
        onMouseMove={handleMouseMove}
      >
        {/*
          The C++ WASM runtime renders directly into this canvas.
          Emscripten is configured to target it via window.Module.canvas
          before game.js runs (see wasm-bridge.ts → loadWasmRuntime).

          We size the canvas to the game resolution; CSS scales it to fit
          the available space while preserving the aspect ratio.
        */}
        <canvas
          ref={canvasRef}
          id="artcade-canvas"
          width={res.x}
          height={res.y}
          className="border border-[#1A253A] shadow-2xl"
          style={{
            maxWidth:  '100%',
            maxHeight: '100%',
            // Show the scene background colour while WASM has not yet painted,
            // preventing a white flash on load.
            background: (() => {
              const sceneId = selection.sceneId ?? project?.activeSceneId
              const bg = project && sceneId ? project.scenes[sceneId]?.backgroundColor : undefined
              return bg
                ? `rgb(${Math.round(bg.x * 255)},${Math.round(bg.y * 255)},${Math.round(bg.z * 255)})`
                : '#0B1121'
            })(),
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
