import { Trash2 } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import type { ComponentKey, EntityDef } from '../../types'
import { applyInputBackspace, isBackspaceKey } from '../../utils/keyboard'
import {
  COMPONENT_REGISTRY,
  type ComponentDescriptor,
} from './component-registry'
import { InspectorSection } from './inspector-fields'
import { componentBlockId } from './entity-component-utils'
import { PhysicsSection } from './PhysicsSection'
import { DEFAULT_PHYSICS, PHYSICS_INSPECTOR } from './physics-defaults'
import { DialogInspectorActions } from './DialogInspectorActions'

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
    <div
      id={componentBlockId(desc.key)}
      className="border border-[var(--border)] rounded-lg p-3 bg-[rgb(var(--border-rgb)/0.1)] mb-2 scroll-mt-24"
    >
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

      {desc.description ? (
        <p className="text-[10px] text-[var(--muted)] leading-snug mb-2">
          {desc.description}
        </p>
      ) : null}

      {desc.key === 'dialog' ? <DialogInspectorActions entity={entity} /> : null}

      {desc.fields
        .filter((f) => !f.visibleWhen || f.visibleWhen(data))
        .map((f) => {
          const v = data[f.key]
          if (f.kind === 'select') {
            return (
              <div key={f.key} className="mb-2">
                <label className="text-[9px] text-[var(--muted)] uppercase">{f.label}</label>
                <select
                  value={String(v ?? 'solid')}
                  onChange={(e) => commit(f.key, e.target.value)}
                  className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                             text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)] transition-colors"
                >
                  {(f.options ?? []).map((o, i) => (
                    <option key={o} value={o}>
                      {f.optionLabels?.[i] ?? o}
                    </option>
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
                           text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)] transition-colors"
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
  const showPhysics = !entity.physics
  if (missing.length === 0 && !showPhysics) return null

  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value === PHYSICS_INSPECTOR.key) {
          dispatch({
            type: 'ENTITY_SET_PHYSICS',
            entityId: entity.id,
            physics: { ...DEFAULT_PHYSICS },
          })
          return
        }
        const desc = COMPONENT_REGISTRY.find((d) => d.key === e.target.value as ComponentKey)
        if (desc)
          dispatch({
            type: 'ENTITY_SET_COMPONENT',
            entityId: entity.id,
            key: desc.key,
            value: desc.create(),
          })
      }}
      className="w-full mb-2 bg-[var(--border)] border border-dashed border-[var(--border-2)]
                 rounded px-2 py-1.5 text-xs text-[var(--muted)]
                 focus:outline-none focus:border-[var(--accent-2)] transition-colors"
    >
      <option value="">＋ Add Component…</option>
      {showPhysics && (
        <option value={PHYSICS_INSPECTOR.key}>{PHYSICS_INSPECTOR.label}</option>
      )}
      {missing.map((d) => (
        <option key={d.key} value={d.key}>{d.label}</option>
      ))}
    </select>
  )
}

export function ComponentsSection({
  entity,
  open,
  onOpenChange,
}: {
  entity: EntityDef
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <InspectorSection
      label="Components"
      defaultOpen
      open={open}
      onOpenChange={onOpenChange}
    >
      <AddComponentBar entity={entity} />
      <PhysicsSection entity={entity} />
      {COMPONENT_REGISTRY.map((desc) => (
        <ComponentSection key={desc.key} entity={entity} desc={desc} />
      ))}
    </InspectorSection>
  )
}
