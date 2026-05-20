import { useEffect, useState } from 'react'
import { Settings, ChevronRight, Trash2 } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import type { EntityDef, ComponentKey } from '../types'
import { editorSetTransform, isReady } from '../utils/wasm-bridge'
import {
  COMPONENT_REGISTRY,
  type ComponentDescriptor,
} from './inspector/component-registry'

// ---- helpers ---------------------------------------------------------------

function SectionRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between text-[10px] text-[var(--muted)]
                    font-bold border-b border-[var(--border)] pb-1 mt-4 mb-2 uppercase tracking-widest">
      {label}
      <ChevronRight size={11} />
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
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])

  function commit() {
    if (onCommit && draft !== String(value)) onCommit(draft)
  }

  return (
    <div className="space-y-0.5 mb-2">
      <label className="text-[9px] text-[var(--muted)] uppercase">{label}</label>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            commit()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
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
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                   text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
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
                onKeyDown={(e) => e.stopPropagation()}
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
  const images = Object.values(state.project?.assets ?? {})

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
    const x = next.x ?? entity.transform.position.x
    const y = next.y ?? entity.transform.position.y
    const rotation = next.rotation ?? entity.transform.rotation
    const scaleX = next.scaleX ?? entity.transform.scale.x
    const scaleY = next.scaleY ?? entity.transform.scale.y

    dispatch({ type: 'UPDATE_ENTITY_TRANSFORM', entityId: entity.id, x, y, rotation, scaleX, scaleY })
    if (isReady()) editorSetTransform(entity.id, x, y, rotation, scaleX, scaleY)
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3" data-panel="inspector">
      {/* Name */}
      <Field
        label="Entity Name"
        value={entity.name}
        cyan
        onCommit={(name) =>
          dispatch({ type: 'ENTITY_SET_NAME', entityId: entity.id, name })
        }
      />

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {entity.tags.map(t => (
          <span key={t} className="bg-[var(--border)] border border-[var(--border-2)] text-[var(--muted)]
                                   text-[9px] px-2 py-0.5 rounded">
            #{t}
          </span>
        ))}
      </div>

      {/* Transform */}
      <SectionRow label="Transform" />
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

      {/* Sprite */}
      <SectionRow label="Sprite" />
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

      {/* ECS Components (data-driven) */}
      <SectionRow label="Components" />
      {COMPONENT_REGISTRY.map((desc) => (
        <ComponentSection key={desc.key} entity={entity} desc={desc} />
      ))}
      <AddComponentBar entity={entity} />

      {/* Script */}
      {entity.scriptPath && (
        <>
          <SectionRow label="Script" />
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
        </>
      )}
    </div>
  )
}

// ---- panel -----------------------------------------------------------------

export default function InspectorPanel() {
  const { state } = useEditor()
  const { project, selection } = state

  const entity = (project && selection.entityId != null)
    ? project.entities[selection.entityId]
    : null

  return (
    <div className="h-full flex flex-col bg-[var(--panel)]" data-panel="inspector">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
        <Settings size={13} className="text-[var(--muted)]" />
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Inspector</span>
      </div>

      {entity ? (
        <EntityInspector key={entity.id} entity={entity} />
      ) : (
        <div className="flex-1 flex items-center justify-center opacity-20">
          <span className="text-[10px] uppercase tracking-widest">Select an entity</span>
        </div>
      )}
    </div>
  )
}
