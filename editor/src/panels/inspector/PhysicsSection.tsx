import { Trash2 } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import type { EntityDef, PhysicsComponent } from '../../types'
import { DEFAULT_PHYSICS, PHYSICS_INSPECTOR } from './physics-defaults'
import { componentBlockId } from './entity-component-utils'

function num(
  label: string,
  value: number,
  onChange: (n: number) => void,
  opts?: { min?: number; step?: number },
) {
  return (
    <div className="mb-2">
      <label className="text-[9px] text-[var(--muted)] uppercase">{label}</label>
      <input
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

export function PhysicsSection({ entity }: { entity: EntityDef }) {
  const { dispatch } = useEditor()
  const physics = entity.physics
  if (!physics) return null

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
        <label className="text-[9px] text-[var(--muted)] uppercase">Body Type</label>
        <select
          value={physics.bodyType}
          onChange={(e) =>
            patch({ bodyType: e.target.value as PhysicsComponent['bodyType'] })
          }
          className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                     text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)]"
        >
          <option value="Dynamic">Dynamic</option>
          <option value="Kinematic">Kinematic</option>
          <option value="Static">Static</option>
        </select>
      </div>

      <div className="mb-2">
        <label className="text-[9px] text-[var(--muted)] uppercase">Collider Shape</label>
        <select
          value={physics.collider.shape}
          onChange={(e) =>
            patchCollider({
              shape: e.target.value as PhysicsComponent['collider']['shape'],
            })
          }
          className="w-full bg-[var(--border)] border border-[var(--border-2)] rounded px-2 py-1
                     text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)]"
        >
          <option value="Rectangle">Rectangle</option>
          <option value="Circle">Circle</option>
        </select>
      </div>

      {isCircle ? (
        num('Radius (px)', physics.collider.size.x, (x) =>
          patchCollider({ size: { x, y: x } }),
        { min: 1 })
      ) : (
        <>
          {num('Width (px)', physics.collider.size.x, (x) =>
            patchCollider({ size: { ...physics.collider.size, x } }),
          { min: 1 })}
          {num('Height (px)', physics.collider.size.y, (y) =>
            patchCollider({ size: { ...physics.collider.size, y } }),
          { min: 1 })}
        </>
      )}

      {num('Offset X (px)', physics.collider.offset.x, (x) =>
        patchCollider({ offset: { ...physics.collider.offset, x } }),
      )}
      {num('Offset Y (px)', physics.collider.offset.y, (y) =>
        patchCollider({ offset: { ...physics.collider.offset, y } }),
      )}
      {num('Density', physics.collider.density, (density) =>
        patchCollider({ density }),
      { min: 0, step: 0.1 })}
      {num('Friction', physics.collider.friction, (friction) =>
        patchCollider({ friction }),
      { min: 0, step: 0.05 })}

      <label className="flex items-center gap-2 mb-2 text-xs text-[var(--text)]">
        <input
          type="checkbox"
          checked={physics.collider.isSensor}
          onChange={(e) => patchCollider({ isSensor: e.target.checked })}
        />
        Sensor (no solid collision)
      </label>
    </div>
  )
}

export function AddPhysicsBar({ entity }: { entity: EntityDef }) {
  const { dispatch } = useEditor()
  if (entity.physics) return null

  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: 'ENTITY_SET_PHYSICS',
          entityId: entity.id,
          physics: { ...DEFAULT_PHYSICS },
        })
      }
      className="w-full mb-2 px-2 py-1.5 rounded text-xs border border-dashed border-[var(--border-2)]
                 text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent-2)] transition-colors"
    >
      ＋ Add Physics (Box2D Body)…
    </button>
  )
}
