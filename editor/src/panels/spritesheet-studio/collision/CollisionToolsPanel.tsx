import type { CollisionProfileDef } from '../../../types'
import type { CollisionShapeRole } from '../../../types/components'
import {
  addCollisionProfileShape,
  formatShapeRoleLabel,
  removeCollisionProfileShape,
} from '../../../utils/collision-profile'

type CollisionToolsPanelProps = Readonly<{
  profile: CollisionProfileDef
  activeShapeIndex: number
  onSelectShape: (index: number) => void
  onPatchProfile: (profile: CollisionProfileDef) => void
}>

const ROLES: CollisionShapeRole[] = ['body', 'feet', 'hurtbox', 'hitbox', 'interaction']

export function CollisionToolsPanel({
  profile,
  activeShapeIndex,
  onSelectShape,
  onPatchProfile,
}: CollisionToolsPanelProps) {
  const shapes = profile.shapes ?? []

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col min-h-0 bg-[var(--panel-2)]">
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-bold">
          Collision shapes
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {shapes.map((shape, index) => (
          <button
            key={`shape-${index}`}
            type="button"
            onClick={() => onSelectShape(index)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs border ${
              index === activeShapeIndex
                ? 'border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.12)]'
                : 'border-[var(--border)] hover:border-[var(--border-2)]'
            }`}
          >
            <span className="font-semibold">{formatShapeRoleLabel(shape.role)}</span>
            <span className="block text-[10px] text-[var(--muted)]">
              {shape.layerId} - {shape.response}
            </span>
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-[var(--border)] space-y-1">
        <button
          type="button"
          className="w-full text-[10px] py-1 rounded border border-[var(--border)] hover:border-[var(--accent)]"
          onClick={() => {
            const next = addCollisionProfileShape(profile)
            onPatchProfile(next)
            onSelectShape(next.shapes.length - 1)
          }}
        >
          + Add shape
        </button>
        {shapes.length > 0 && (
          <button
            type="button"
            className="w-full text-[10px] py-1 rounded border border-[var(--border)] text-[var(--danger)] hover:border-[var(--danger)]"
            onClick={() => {
              const next = removeCollisionProfileShape(profile, activeShapeIndex)
              onPatchProfile(next)
              onSelectShape(Math.max(0, activeShapeIndex - 1))
            }}
          >
            Remove selected
          </button>
        )}
      </div>
      <div className="px-3 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">
        Drag handles on the frame to resize. Coordinates are normalized to the active frame.
      </div>
    </aside>
  )
}

export { ROLES }
