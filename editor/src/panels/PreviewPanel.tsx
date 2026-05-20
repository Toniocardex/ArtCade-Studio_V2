import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { MousePointer2, Hand, Paintbrush, Eraser, Wifi, WifiOff, Grid3x3, Ruler } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry } from '../types'
import {
  loadWasmRuntime, isReady,
  syncEditorRuntimeState,
  editorSetSelectedTile,
  editorRegisterImage, editorSetTool, editorSetGuidesEnabled,
} from '../utils/wasm-bridge'
import { readProjectImageBytes } from '../utils/api'
import { dirName } from '../utils/project'

import { WASM_RUNTIME_SRC } from '../utils/runtime-path'

type Tool = 'select' | 'pan' | 'paint' | 'erase' | 'tile'
type RuntimeToolId = 0 | 1 | 2 | 3

const RUNTIME_TOOL: Record<Tool, RuntimeToolId> = {
  select: 0,
  pan:    1,
  paint:  2,
  erase:  3,
  tile:   2,
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
  const { project, projectPath, isPlaying, selection, selectedTileCell, mode } = state

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const lastProjectLoadKeyRef = useRef<string | null>(null)
  const registeredAssetsRef   = useRef<Set<string>>(new Set())
  // current scene id for the (mount-time) onTilemapPainted callback
  const sceneIdRef = useRef<string>('')
  sceneIdRef.current = selection.sceneId ?? project?.activeSceneId ?? ''
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

  useLayoutEffect(() => {
    syncRuntimeUiFlags()
  })

  // ── Load WASM runtime once (singleton — safe under StrictMode / HMR) ─────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false

    const callbacks = {
      onReady: () => {
        syncRuntimeUiFlags()
        if (cancelled) return
        setTimeout(() => dispatch({
          type: 'LOG',
          entry: makeLogEntry('[WASM] Runtime initialised — editor mode active.', 'info'),
        }), 0)
      },

      onEntitySelected: (entityId: number) => {
        if (cancelled) return
        dispatch({ type: 'SELECT_ENTITY', entityId })
      },

      onEntityTransformChanged: (
        entityId: number, x: number, y: number,
        rotation: number, scaleX: number, scaleY: number,
      ) => {
        if (cancelled) return
        setTimeout(() => dispatch({
          type: 'UPDATE_ENTITY_TRANSFORM',
          entityId, x, y, rotation, scaleX, scaleY,
        }), 0)
      },

      onConsoleLine: (message: string, level: string) => {
        if (cancelled) return
        const entry = makeLogEntry(message, level)
        if (message.includes('[EditorAPI] Bridge initialised')) {
          setTimeout(() => { if (!cancelled) setEngineReady(true) }, 0)
        }
        setTimeout(() => dispatch({ type: 'LOG', entry }), 0)
      },

      onTilemapPainted: (col: number, row: number, tileId: number) => {
        if (cancelled) return
        const sceneId = sceneIdRef.current
        if (!sceneId) return
        setTimeout(() => dispatch({
          type: 'TILEMAP_PAINT_CELL', sceneId, col, row, tileId,
        }), 0)
      },
    }

    if (isReady()) {
      callbacks.onReady()
      void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, callbacks)
      return () => { cancelled = true }
    }

    void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, callbacks).catch((err) => {
      if (!cancelled) {
        console.error('[PreviewPanel] WASM init failed:', err)
        dispatch({
          type: 'LOG',
          entry: makeLogEntry(`[WASM] Init failed: ${String(err)}`, 'error'),
        })
      }
    })

    return () => { cancelled = true }
  }, [dispatch])

  // Re-bind canvas when returning to Canvas view (viewport was display:none).
  useEffect(() => {
    if (mode !== 'canvas') return
    const canvas = canvasRef.current
    if (!canvas || !isReady()) return
    syncRuntimeUiFlags()
    void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, {
      onReady: syncRuntimeUiFlags,
      onEntitySelected:         (id) => dispatch({ type: 'SELECT_ENTITY', entityId: id }),
      onEntityTransformChanged: (entityId, x, y, rotation, scaleX, scaleY) =>
        dispatch({ type: 'UPDATE_ENTITY_TRANSFORM', entityId, x, y, rotation, scaleX, scaleY }),
      onConsoleLine: (message, level) => {
        if (message.includes('[EditorAPI] Bridge initialised')) setEngineReady(true)
        dispatch({ type: 'LOG', entry: makeLogEntry(message, level) })
      },
    })
  }, [mode, dispatch])

  // ── Re-sync project into C++ whenever the user opens a new project ────────
  useEffect(() => {
    if (!wasmReady || !engineReady || !project) return
    // NOTE: tilemap.data is intentionally NOT in the key — during in-scene
    // painting the C++ runtime is the source of truth and notifies React;
    // re-syncing the whole project on every cell would flood editor_load_project.
    // The tilemap STRUCTURE (cols/rows/tilesetAssetId) IS included so that
    // creating/attaching a tileset re-syncs once and the runtime gets the layer.
    const activeScene = project.scenes[project.activeSceneId]
    const at = activeScene?.tilemap
    // Sprite-assignment fingerprint: assigning a sprite to an entity mutates
    // only entity.sprite.spriteAssetId — without this the loadKey wouldn't
    // change and the runtime would never receive the new sprite (assets
    // loaded but "not assigned"). Small (one short string per entity).
    const spriteFp = Object.values(project.entities)
      .map((e) => e.sprite?.spriteAssetId ?? '')
      .join(',')
    const sceneSizeFp = Object.values(project.scenes)
      .map((s) => `${s.id}:${s.worldSize.x}x${s.worldSize.y}:${s.viewportSize.x}x${s.viewportSize.y}`)
      .join(',')
    const loadKey = [
      projectPath ?? project.projectName,
      project.version,
      project.activeSceneId,
      Object.keys(project.entities).length,
      Object.keys(project.scenes).length,
      sceneSizeFp,
      at ? `${at.cols}x${at.rows}:${at.tilesetAssetId ?? ''}` : 'no-tm',
      spriteFp,
    ].join('|')
    if (lastProjectLoadKeyRef.current === loadKey) return
    lastProjectLoadKeyRef.current = loadKey
    syncEditorRuntimeState({ projectJson: JSON.stringify(project) })
  }, [project, projectPath, wasmReady, engineReady])

  // ── Deliver the persistent image library to the C++ renderer ─────────────
  // On project open (and after an import) every ProjectDoc.assets entry is
  // pushed into the runtime texture cache keyed by its relative path (==
  // entity.sprite.spriteAssetId / TilesetAsset.spriteImagePath), so sprites
  // and tilesets render after reopening without re-importing.
  useEffect(() => {
    if (!wasmReady || !engineReady || !project?.assets) return
    const root = projectPath ? dirName(projectPath) : ''
    const assets = project.assets
    void (async () => {
      for (const asset of Object.values(assets)) {
        const key = `${asset.path}#${asset.dataUrl ? 'd' : 'f'}`
        if (registeredAssetsRef.current.has(key)) continue
        let bytes: Uint8Array | null = null
        if (asset.dataUrl) {
          try {
            const b64 = asset.dataUrl.split(',')[1] ?? ''
            const bin = atob(b64)
            const u8  = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
            bytes = u8
          } catch { bytes = null }
        } else if (root) {
          bytes = await readProjectImageBytes(root, asset.path)
        }
        if (!bytes || bytes.length === 0) continue
        const ext = `.${(asset.path.split('.').pop() ?? 'png').toLowerCase()}`
        if (editorRegisterImage(asset.path, bytes, ext))
          registeredAssetsRef.current.add(key)
      }
    })()
  }, [project?.assets, projectPath, wasmReady, engineReady])

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

  // ── Phase F2: sync tile-paint mode + brush tile to C++ ───────────────────
  // Three tools drive tilemap painting:
  //   • tile / paint → paint the brush cell selected in TILESET_EDITOR
  //   • erase        → paint cell 0 (clears the tile) without touching the
  //                     user's picked brush in the store
  useEffect(() => {
    if (!wasmReady || !engineReady) return
    const painting =
      activeTool === 'tile' || activeTool === 'paint' || activeTool === 'erase'
    editorSetTool(RUNTIME_TOOL[activeTool])
    if (painting)
      editorSetSelectedTile(activeTool === 'erase' ? 0 : selectedTileCell)
  }, [activeTool, selectedTileCell, wasmReady, engineReady])

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    editorSetGuidesEnabled(showEditorGuides && !isPlaying)
  }, [showEditorGuides, isPlaying, wasmReady, engineReady])

  // ── Canvas resolution matches game resolution ─────────────────────────────
  const res = project?.gameResolution ?? { x: 1280, y: 720 }

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
          { id: 'pan',    Icon: Hand,           color: 'var(--muted)',  title: 'Pan the view' },
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
          { id: 'paint', Icon: Paintbrush, title: 'Paint tiles with the selected TILESET_EDITOR cell' },
          { id: 'erase', Icon: Eraser,     title: 'Erase tiles (clears the cell under the cursor)' },
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
          title={`Tile paint (brush ${selectedTileCell === 0 ? 'eraser' : '#' + selectedTileCell})`}
          className={`p-1.5 rounded transition-colors ${
            activeTool === 'tile' ? 'bg-[rgb(var(--accent-2-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
          }`}
        >
          <Grid3x3 size={15} color={activeTool === 'tile' ? 'var(--accent-2)' : 'var(--muted)'} />
        </button>

        <div className="h-px w-full bg-[var(--border)]" />

        <button
          onClick={() => setShowEditorGuides(v => !v)}
          title="Toggle editor guides"
          className={`p-1.5 rounded transition-colors ${
            showEditorGuides ? 'bg-[rgb(var(--accent-rgb)/0.2)]' : 'hover:bg-[var(--panel-3)]'
          }`}
        >
          <Ruler size={15} color={showEditorGuides ? 'var(--accent)' : 'var(--muted)'} />
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

        {/* Resolution badge */}
        <div className="absolute bottom-8 right-8 text-[9px] text-[var(--muted)]
                        bg-[var(--panel)] border border-[var(--border)] rounded px-1.5 py-0.5
                        select-none pointer-events-none">
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
