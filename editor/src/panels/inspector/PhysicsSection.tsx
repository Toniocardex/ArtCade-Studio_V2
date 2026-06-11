import { Trash2 } from 'lucide-react'
import { useEditorDispatch } from '../../store/editor-store'
import type { EntityDef, PhysicsComponent } from '../../types'
import { PHYSICS_INSPECTOR } from './physics-defaults'
import { componentBlockId } from './entity-component-utils'
import { EditorSelect } from '../../components/ui/EditorSelect'

function numInputId(entityId: number, label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `physics-${entityId}-${slug}`
}

function num(
  entityId: number,
  label: string,
  value: number,
  onChange: (n: number) => void,
  opts?: { min?: number; step?: number },
) {
  const inputId = numInputId(entityId, label)
  return (
    <div className="mb-2">
      <label htmlFor={inputId} className="text-[9px] text-[var(--muted)] uppercase">
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        value={value}
        min={opts?.min}
        step={opts?.step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                   text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)]"
      />
    </div>
  )
}

export type PhysicsSectionProps = Readonly<{
  entity: EntityDef
}>

export function PhysicsSection({ entity }: PhysicsSectionProps) {
  const dispatch = useEditorDispatch()
  const physics = entity.physics
  if (!physics) return null

  const bodyTypeSelectId = `physics-body-type-${entity.id}`
  const shapeSelectId = `physics-shape-${entity.id}`

  function patch(partial: Partial<PhysicsComponent>) {
    dispatch({
      type: 'ENTITY_SET_PHYSICS',
      entityId: entity.id,
      physics: { ...physics!, ...partial },
    })
  }

  function patchCollider(partial: Partial<PhysicsComponent['collider']>) {
    patch({ collider: { ...physics!.collider, ...partial } })
  }

  const isCircle = physics.collider.shape === 'Circle'

  return (
    <div
      id={componentBlockId('physics')}
      className="border border-[var(--border)] rounded-lg p-3 bg-[rgb(var(--border-rgb)/0.1)] mb-2 scroll-mt-24"
    >
      <div
        className="flex items-center justify-between text-[10px] font-bold
                   border-b border-[var(--border)] pb-1 mb-2 uppercase tracking-widest"
        style={{ color: PHYSICS_INSPECTOR.color }}
      >
        <span>{PHYSICS_INSPECTOR.label}</span>
        <button
          type="button"
          title="Remove Physics"
          onClick={() =>
            dispatch({ type: 'ENTITY_REMOVE_PHYSICS', entityId: entity.id })
          }
          className="text-[var(--muted)] hover:text-[var(--danger)]"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <p className="text-[10px] text-[var(--muted)] leading-snug mb-2">
        {PHYSICS_INSPECTOR.description}
      </p>

      <div className="mb-2">
        <label htmlFor={bodyTypeSelectId} className="text-[9px] text-[var(--muted)] uppercase">
          Body Type
        </label>
        <EditorSelect
          id={bodyTypeSelectId}
          value={physics.bodyType}
          onChange={(bodyType) =>
            patch({ bodyType: bodyType as PhysicsComponent['bodyType'] })
          }
          triggerClassName="py-1"
          options={[
            { value: 'Dynamic', label: 'Dynamic' },
            { value: 'Kinematic', label: 'Kinematic' },
            { value: 'Static', label: 'Static' },
          ]}
        />
      </div>

      <div className="mb-2">
        <label htmlFor={shapeSelectId} className="text-[9px] text-[var(--muted)] uppercase">
          Collider Shape
        </label>
        <EditorSelect
          id={shapeSelectId}
          value={physics.collider.shape}
          onChange={(shape) =>
            patchCollider({
              shape: shape as PhysicsComponent['collider']['shape'],
            })
          }
          triggerClassName="py-1"
          options={[
            { value: 'Rectangle', label: 'Rectangle' },
            { value: 'Circle', label: 'Circle' },
          ]}
        />
      </div>

      {isCircle ? (
        num(entity.id, 'Radius (px)', physics.collider.size.x, (x) =>
          patchCollider({ size: { x, y: x } }),
        { min: 1 })
      ) : (
        <>
          {num(entity.id, 'Width (px)', physics.collider.size.x, (x) =>
            patchCollider({ size: { ...physics.collider.size, x } }),
          { min: 1 })}
          {num(entity.id, 'Height (px)', physics.collider.size.y, (y) =>
            patchCollider({ size: { ...physics.collider.size, y } }),
          { min: 1 })}
        </>
      )}

      {num(entity.id, 'Offset X (px)', physics.collider.offset.x, (x) =>
        patchCollider({ offset: { ...physics.collider.offset, x } }),
      )}
      {num(entity.id, 'Offset Y (px)', physics.collider.offset.y, (y) =>
        patchCollider({ offset: { ...physics.collider.offset, y } }),
      )}
      {num(entity.id, 'Density', physics.collider.density, (density) =>
        patchCollider({ density }),
      { min: 0, step: 0.1 })}
      {num(entity.id, 'Friction', physics.collider.friction, (friction) =>
        patchCollider({ friction }),
      { min: 0, step: 0.05 })}

      <label className="flex items-center gap-2 mb-2 text-xs text-[var(--text)]">
        <input
          type="checkbox"
          checked={physics.collider.isSensor}
          onChange={(e) => patchCollider({ isSensor: e.target.checked })}
        />
        <span>Sensor (no solid collision)</span>
      </label>
    </div>
  )
}
