import { Trash2 } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { ComponentKey, EntityDef } from '../../types'
import { applyInputBackspace, isBackspaceKey } from '../../utils/keyboard'
import {
  COMPONENT_REGISTRY,
  type ComponentDescriptor,
} from './component-registry'
import { InspectorSection } from './inspector-fields'
import { componentBlockId } from './entity-component-utils'
import { EditorSelect } from '../../components/ui/EditorSelect'
import { PhysicsSection } from './PhysicsSection'
import { DEFAULT_PHYSICS, PHYSICS_INSPECTOR } from './physics-defaults'
import { DialogInspectorActions } from './DialogInspectorActions'

function fieldStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  return fallback
}

type ComponentSectionProps = Readonly<{
  entity: EntityDef
  desc: ComponentDescriptor
}>

function ComponentSection({ entity, desc }: ComponentSectionProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((state) => state.project)
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
          type="button"
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
          if (f.kind === 'variable') {
            const scope = data.bindScope === 'local' ? 'local' : 'global'
            const definitions = scope === 'local'
              ? entity.localVariables ?? []
              : project?.globalVariables ?? []
            return (
              <div key={f.key} className="mb-2">
                <label className="text-[9px] text-[var(--muted)] uppercase">{f.label}</label>
                <EditorSelect
                  value={fieldStringValue(v)}
                  onChange={(next) => commit(f.key, next)}
                  triggerClassName="py-1"
                  options={[
                    { value: '', label: scope === 'global' ? 'No global variable' : 'No local variable' },
                    ...definitions.map((definition) => ({
                      value: definition.key,
                      label: `${definition.key} (${definition.type})`,
                    })),
                  ]}
                  aria-label={f.label}
                />
              </div>
            )
          }
          if (f.kind === 'select') {
            return (
              <div key={f.key} className="mb-2">
                <label className="text-[9px] text-[var(--muted)] uppercase">{f.label}</label>
                <EditorSelect
                  value={fieldStringValue(v, 'solid')}
                  onChange={(next) => {
                    if (f.key === 'bindScope') {
                      dispatch({
                        type: 'ENTITY_SET_COMPONENT',
                        entityId: entity.id,
                        key: desc.key,
                        value: { ...data, bindScope: next, bindKey: '' },
                      })
                    } else {
                      commit(f.key, next)
                    }
                  }}
                  triggerClassName="py-1"
                  options={(f.options ?? []).map((o, i) => ({
                    value: o,
                    label: f.optionLabels?.[i] ?? o,
                  }))}
                  aria-label={f.label}
                />
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
                value={isNum ? Number(v ?? 0) : fieldStringValue(v)}
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
                           text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          )
        })}
    </div>
  )
}

type AddComponentBarProps = Readonly<{
  entity: EntityDef
}>

function AddComponentBar({ entity }: AddComponentBarProps) {
  const dispatch = useEditorDispatch()
  const missing = COMPONENT_REGISTRY.filter(
    (d) => !(entity as unknown as Record<string, unknown>)[d.key],
  )
  const showPhysics = !entity.physics
  if (missing.length === 0 && !showPhysics) return null

  return (
    <EditorSelect
      value=""
      onChange={(picked) => {
        if (picked === PHYSICS_INSPECTOR.key) {
          dispatch({
            type: 'ENTITY_SET_PHYSICS',
            entityId: entity.id,
            physics: { ...DEFAULT_PHYSICS },
          })
          return
        }
        const desc = COMPONENT_REGISTRY.find((d) => d.key === picked as ComponentKey)
        if (desc)
          dispatch({
            type: 'ENTITY_SET_COMPONENT',
            entityId: entity.id,
            key: desc.key,
            value: desc.create(),
          })
      }}
      className="w-full mb-2"
      placeholder="＋ Add Component…"
      options={[
        ...(showPhysics
          ? [{ value: PHYSICS_INSPECTOR.key, label: PHYSICS_INSPECTOR.label }]
          : []),
        ...missing.map((d) => ({ value: d.key, label: d.label })),
      ]}
      aria-label="Add component"
    />
  )
}

export type ComponentsSectionProps = Readonly<{
  entity: EntityDef
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>

export function ComponentsSection({
  entity,
  open,
  onOpenChange,
}: ComponentsSectionProps) {
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
