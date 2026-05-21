import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Settings, ChevronRight, Trash2 } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import type { EntityDef, ComponentKey, SceneDef } from '../types'
import { runtimeSync } from '../utils/runtime-sync-service'
import {
  COMPONENT_REGISTRY,
  type ComponentDescriptor,
} from './inspector/component-registry'
import { applyInputBackspace, isBackspaceKey } from '../utils/keyboard'

// ---- helpers ---------------------------------------------------------------

function InspectorSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-[10px] text-[var(--muted)]
                   hover:text-[var(--text)] font-bold border-b border-[var(--border)] pb-1 mb-2
                   uppercase tracking-widest transition-colors"
      >
        <span>{label}</span>
        <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function Field({
  label, value, onCommit, cyan = false,
}: {
  label: string
  value: string | number
  onCommit?: (value: string) => void
  cyan?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lastCommitted = useRef(String(value))

  useEffect(() => {
    const el = inputRef.current
    if (!el || document.activeElement === el) return
    el.value = String(value)
    lastCommitted.current = String(value)
  }, [value])

  function commitFromInput() {
    const v = inputRef.current?.value ?? ''
    if (onCommit && v !== lastCommitted.current) {
      onCommit(v)
      lastCommitted.current = v
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation()
    const input = e.currentTarget

    if (isBackspaceKey(e)) {
      e.preventDefault()
      applyInputBackspace(input)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      commitFromInput()
      input.blur()
    }
  }

  return (
    <div className="space-y-0.5 mb-2">
      <label className="text-[9px] text-[var(--muted)] uppercase">{label}</label>
      <input
        ref={inputRef}
        type="text"
        defaultValue={String(value)}
        onBlur={commitFromInput}
        onKeyDown={handleKeyDown}
        className={`w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                    text-xs focus:outline-none focus:border-[var(--accent)] transition-colors ${
                      cyan ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                    }`}
      />
    </div>
  )
}

function NumberField({
  label, value, onCommit,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
}) {
  return (
    <div>
      <label className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)]">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={e => onCommit(Number(e.target.value))}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (isBackspaceKey(e)) {
            e.preventDefault()
            applyInputBackspace(e.currentTarget)
          }
        }}
        className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                   text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  )
}

function parseSceneDimension(value: string, fallback: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(8192, Math.max(64, n)) : fallback
}

function parseGridSize(value: string, fallback: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(512, Math.max(4, n)) : fallback
}

function snapToGridValue(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value
}

function SceneSettings({ scene }: { scene: SceneDef }) {
  const { state, dispatch } = useEditor()
  const gridSize = state.editorGridSize ?? 32

  function commitWorld(patch: Partial<{ x: number; y: number }>) {
    dispatch({
      type: 'SCENE_SET_WORLD_SIZE',
      sceneId: scene.id,
      x: patch.x ?? scene.worldSize.x,
      y: patch.y ?? scene.worldSize.y,
    })
  }

  function commitViewport(patch: Partial<{ x: number; y: number }>) {
    dispatch({
      type: 'SCENE_SET_VIEWPORT_SIZE',
      sceneId: scene.id,
      x: patch.x ?? scene.viewportSize.x,
      y: patch.y ?? scene.viewportSize.y,
    })
  }

  function commitGridSize(value: string) {
    dispatch({
      type: 'EDITOR_SET_GRID_SIZE',
      tileSize: parseGridSize(value, gridSize),
    })
  }

  return (
    <InspectorSection label="Scene Settings" defaultOpen>
      <div className="mb-3">
        <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Scene Size</label>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Width"
            value={scene.worldSize.x}
            onCommit={(value) => commitWorld({
              x: parseSceneDimension(value, scene.worldSize.x),
            })}
          />
          <Field
            label="Height"
            value={scene.worldSize.y}
            onCommit={(value) => commitWorld({
              y: parseSceneDimension(value, scene.worldSize.y),
            })}
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Viewport</label>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Width"
            value={scene.viewportSize.x}
            onCommit={(value) => commitViewport({
              x: parseSceneDimension(value, scene.viewportSize.x),
            })}
          />
          <Field
            label="Height"
            value={scene.viewportSize.y}
            onCommit={(value) => commitViewport({
              y: parseSceneDimension(value, scene.viewportSize.y),
            })}
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Editor Grid</label>
        <div className="grid grid-cols-2 gap-2 items-end">
          <Field
            label="Size (px)"
            value={gridSize}
            onCommit={commitGridSize}
          />
          <label className="flex items-center gap-2 mb-2 text-[9px] text-[var(--muted)] uppercase select-none">
            <input
              type="checkbox"
              checked={state.snapToGrid ?? false}
              onChange={(e) => dispatch({ type: 'SET_SNAP_TO_GRID', enabled: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Snap to grid
          </label>
        </div>
      </div>
      {scene.tilemap && (
        <p className="text-[9px] text-[var(--muted)] leading-snug mb-3">
          Tilemap: {scene.tilemap.cols} x {scene.tilemap.rows} cells at {scene.tilemap.tileSize}px.
        </p>
      )}
    </InspectorSection>
  )
}

// ---- data-driven component section -----------------------------------------

function ComponentSection({
  entity, desc,
}: {
  entity: EntityDef
  desc: ComponentDescriptor
}) {
  const { dispatch } = useEditor()
  const data = (entity as unknown as Record<string, unknown>)[desc.key] as
    | Record<string, unknown>
    | undefined
  if (!data) return null

  function commit(fieldKey: string, value: unknown) {
    dispatch({
      type: 'ENTITY_SET_COMPONENT',
      entityId: entity.id,
      key: desc.key,
      value: { ...data, [fieldKey]: value },
    })
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-3 bg-[rgb(var(--border-rgb)/0.1)] mb-2">
      <div
        className="flex items-center justify-between text-[10px] font-bold
                   border-b border-[var(--border)] pb-1 mb-2 uppercase tracking-widest"
        style={{ color: desc.color }}
      >
        <span>{desc.label}</span>
        <button
          title="Remove component"
          onClick={() =>
            dispatch({
              type: 'ENTITY_REMOVE_COMPONENT',
              entityId: entity.id,
              key: desc.key,
            })
          }
          className="text-[var(--muted)] hover:text-[var(--danger)]"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {desc.fields
        .filter((f) => !f.visibleWhen || f.visibleWhen(data))
        .map((f) => {
          const v = data[f.key]
          if (f.kind === 'select') {
            return (
              <div key={f.key} className="mb-2">
                <label className="text-[9px] text-[var(--muted)] uppercase">{f.label}</label>
                <select
                  value={String(v ?? '')}
                  onChange={(e) => commit(f.key, e.target.value)}
                  className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                             text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )
          }
          if (f.kind === 'checkbox') {
            return (
              <label key={f.key} className="flex items-center gap-2 mb-2 text-xs text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={Boolean(v)}
                  onChange={(e) => commit(f.key, e.target.checked)}
                />
                {f.label}
              </label>
            )
          }
          const isNum = f.kind === 'number'
          return (
            <div key={f.key} className="mb-2">
              <label className="text-[9px] text-[var(--muted)] uppercase">{f.label}</label>
              <input
                type={isNum ? 'number' : 'text'}
                value={isNum ? Number(v ?? 0) : String(v ?? '')}
                min={f.min}
                max={f.max}
                step={f.step}
                onChange={(e) =>
                  commit(f.key, isNum ? Number(e.target.value) : e.target.value)
                }
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (!isNum && isBackspaceKey(e)) {
                    e.preventDefault()
                    applyInputBackspace(e.currentTarget)
                  }
                }}
                className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                           text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )
        })}
    </div>
  )
}

function AddComponentBar({ entity }: { entity: EntityDef }) {
  const { dispatch } = useEditor()
  const missing = COMPONENT_REGISTRY.filter(
    (d) => !(entity as unknown as Record<string, unknown>)[d.key],
  )
  if (missing.length === 0) return null

  return (
    <select
      value=""
      onChange={(e) => {
        const desc = COMPONENT_REGISTRY.find((d) => d.key === e.target.value as ComponentKey)
        if (desc)
          dispatch({
            type: 'ENTITY_SET_COMPONENT',
            entityId: entity.id,
            key: desc.key,
            value: desc.create(),
          })
      }}
      className="w-full mt-1 bg-[var(--border)] border border-dashed border-[var(--border-2)]
                 rounded px-2 py-1.5 text-xs text-[var(--muted)]
                 focus:outline-none focus:border-[var(--accent)]"
    >
      <option value="">＋ Add Component…</option>
      {missing.map((d) => (
        <option key={d.key} value={d.key}>{d.label}</option>
      ))}
    </select>
  )
}

// ---- entity inspector -------------------------------------------------------

function EntityInspector({ entity }: { entity: EntityDef }) {
  const { state, dispatch } = useEditor()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const images = Object.values(state.project?.assets ?? {})

  function openLogicBoard() {
    dispatch({ type: 'SELECT_ENTITY', entityId: entity.id })
    dispatch({ type: 'SET_MODE', mode: 'logic' })
  }

  function commitSprite(patch: Partial<EntityDef['sprite']>) {
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: entity.id,
      sprite: { ...entity.sprite, ...patch },
    })
  }

  function commitTransform(next: Partial<{
    x: number; y: number; rotation: number; scaleX: number; scaleY: number
  }>) {
    const sceneId = state.selection.sceneId ?? state.project?.activeSceneId
    const activeScene = sceneId ? state.project?.scenes[sceneId] : undefined
    const gridSize = state.editorGridSize ?? activeScene?.tilemap?.tileSize ?? 32
    const rawX = next.x ?? entity.transform.position.x
    const rawY = next.y ?? entity.transform.position.y
    const x = state.snapToGrid ? snapToGridValue(rawX, gridSize) : rawX
    const y = state.snapToGrid ? snapToGridValue(rawY, gridSize) : rawY
    const rotation = next.rotation ?? entity.transform.rotation
    const scaleX = next.scaleX ?? entity.transform.scale.x
    const scaleY = next.scaleY ?? entity.transform.scale.y

    dispatch({ type: 'UPDATE_ENTITY_TRANSFORM', entityId: entity.id, x, y, rotation, scaleX, scaleY })
    runtimeSync.syncEntityTransform({ entityId: entity.id, x, y, rotation, scaleX, scaleY })
  }

  return (
    <>
      <InspectorSection label="Entity Settings" defaultOpen>
        <Field
          label="Entity Name"
          value={entity.name}
          cyan
          onCommit={(name) =>
            dispatch({ type: 'ENTITY_SET_NAME', entityId: entity.id, name })
          }
        />
        <p className="text-[9px] text-[var(--muted)] -mt-1 mb-2 leading-snug">
          Shown in Hierarchy and Logic Board. Rules are per entity, not per name.
        </p>

        <button
          type="button"
          onClick={openLogicBoard}
          className="w-full mb-3 px-3 py-1.5 rounded text-xs font-semibold border border-[var(--accent-bd)]
                     bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
        >
          Open Logic Board
        </button>

        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          className="mb-3 text-xs border border-[var(--border)] rounded-lg px-3 py-2"
        >
          <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)] select-none font-bold uppercase text-[9px] tracking-widest">
            Advanced
          </summary>
          <div className="mt-2">
            <Field
              label="Spawn group (className)"
              value={entity.className}
              onCommit={(className) =>
                dispatch({ type: 'ENTITY_SET_CLASSNAME', entityId: entity.id, className })
              }
            />
            <p className="text-[9px] text-[var(--muted)] leading-snug">
              Runtime pools, spawn, and collision widgets use this. Logic Board rules do not.
            </p>
          </div>
        </details>

        <div className="flex flex-wrap gap-1 mb-3">
          {entity.tags.map(t => (
            <span key={t} className="bg-[var(--border)] border border-[var(--border-2)] text-[var(--muted)]
                                     text-[9px] px-2 py-0.5 rounded">
              #{t}
            </span>
          ))}
        </div>
      </InspectorSection>

      <InspectorSection label="Transform" defaultOpen>
        <div className="mb-2">
          <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Position</label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={entity.transform.position.x} onCommit={x => commitTransform({ x })} />
            <NumberField label="Y" value={entity.transform.position.y} onCommit={y => commitTransform({ y })} />
          </div>
        </div>
        <div className="mb-2">
          <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Scale</label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={entity.transform.scale.x} onCommit={scaleX => commitTransform({ scaleX })} />
            <NumberField label="Y" value={entity.transform.scale.y} onCommit={scaleY => commitTransform({ scaleY })} />
          </div>
        </div>
        <div className="mb-2">
          <label className="text-[9px] text-[var(--muted)] uppercase block mb-0.5">Rotation</label>
          <NumberField label="Radians" value={entity.transform.rotation} onCommit={rotation => commitTransform({ rotation })} />
        </div>
      </InspectorSection>

      <InspectorSection label="Sprite">
        <div className="mb-2">
          <label className="text-[9px] text-[var(--muted)] uppercase">Asset</label>
          <select
            value={entity.sprite.spriteAssetId}
            onChange={(e) => commitSprite({ spriteAssetId: e.target.value })}
            className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                       text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">(none)</option>
            {/* keep an unknown/legacy value selectable */}
            {entity.sprite.spriteAssetId &&
              !images.some((a) => a.path === entity.sprite.spriteAssetId) && (
                <option value={entity.sprite.spriteAssetId}>
                  {entity.sprite.spriteAssetId}
                </option>
              )}
            {images.map((a) => (
              <option key={a.id} value={a.path}>{a.name}</option>
            ))}
          </select>
          {images.length === 0 && (
            <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] mt-0.5">
              Import images in the ASSETS panel, then pick one here.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <NumberField
            label="Alpha"
            value={entity.sprite.alpha}
            onCommit={(v) => commitSprite({ alpha: Math.min(1, Math.max(0, v)) })}
          />
          <NumberField
            label="Render Order"
            value={entity.sprite.renderOrder}
            onCommit={(v) => commitSprite({ renderOrder: Math.round(v) })}
          />
        </div>
      </InspectorSection>

      <InspectorSection label="Components">
        {COMPONENT_REGISTRY.map((desc) => (
          <ComponentSection key={desc.key} entity={entity} desc={desc} />
        ))}
        <AddComponentBar entity={entity} />
      </InspectorSection>

      {/* Script */}
      {entity.scriptPath && (
        <InspectorSection label="Script">
          <Field label="Path" value={entity.scriptPath} />
          <button
            onClick={() => dispatch({
              type: 'OPEN_SCRIPT',
              file: { path: entity.scriptPath!, content: '', isDirty: false },
            })}
            className="w-full mt-1 px-3 py-1 bg-[rgb(var(--accent-2-rgb)/0.1)] border border-[rgb(var(--accent-2-rgb)/0.4)]
                       text-[var(--accent-2)] text-[10px] font-bold rounded hover:bg-[rgb(var(--accent-2-rgb)/0.2)]
                       transition-colors"
          >
            OPEN IN LOGIC_BOARD →
          </button>
        </InspectorSection>
      )}
    </>
  )
}

// ---- panel -----------------------------------------------------------------

export default function InspectorPanel() {
  const { state } = useEditor()
  const { project, selection } = state

  const entity = (project && selection.entityId != null)
    ? project.entities[selection.entityId]
    : null
  const sceneId = selection.sceneId ?? project?.activeSceneId
  const scene = project && sceneId ? project.scenes[sceneId] : null

  return (
    <div className="h-full flex flex-col bg-[var(--panel)]" data-panel="inspector">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
        <Settings size={13} className="text-[var(--muted)]" />
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Inspector</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" data-panel="inspector">
        {scene && <SceneSettings scene={scene} />}

        {entity ? (
          <EntityInspector key={entity.id} entity={entity} />
        ) : (
          <div className="py-8 flex items-center justify-center opacity-20">
            <span className="text-[10px] uppercase tracking-widest">Select an entity</span>
          </div>
        )}
        {!scene && (
          <div className="py-8 flex items-center justify-center opacity-20">
            <span className="text-[10px] uppercase tracking-widest">No active scene</span>
          </div>
        )}
        </div>
    </div>
  )
}
