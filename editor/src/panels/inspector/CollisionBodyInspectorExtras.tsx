import { Film } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import {
  resolvedCollisionShapes,
  resolveCollisionProfileForEntity,
} from '../../utils/collision-profile'
import { findImageAssetByPath } from '../../utils/sprite-pivot-resolve'
import { openSpritesheetStudio } from '../spritesheet-studio/openSpritesheetStudio'

type CollisionBodyInspectorExtrasProps = Readonly<{
  entity: EntityDef
}>

export function CollisionBodyInspectorExtras({ entity }: CollisionBodyInspectorExtrasProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const profile = resolveCollisionProfileForEntity(entity, project)
  const shapes = resolvedCollisionShapes(entity, project)
  const spritePath = entity.sprite?.spriteAssetId
  const linkedAsset = spritePath ? findImageAssetByPath(project?.assets, spritePath) : undefined

  return (
    <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
      {profile ? (
        <div className="text-[10px] text-[var(--muted)] space-y-1">
          <p>
            Profile: <span className="text-[var(--text)]">{profile.name}</span>
          </p>
          {shapes.map((shape, index) => (
            <p key={`${shape.role}-${index}`}>
              {shape.role} - layer <span className="text-[var(--text)]">{shape.layerId}</span>
              {' - mask '}
              <span className="text-[var(--text)]">{(shape.maskLayerIds ?? []).join(', ') || '-'}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--muted)]">
          Inline shapes: {entity.collisionBody?.shapes?.length ?? 0}
        </p>
      )}
      {linkedAsset ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-2 py-1 text-[9px] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
          onClick={() => openSpritesheetStudio(dispatch, project, linkedAsset.id, 'collision')}
        >
          <Film size={12} />
          Edit collision in Sprite Studio
        </button>
      ) : (
        <p className="text-[9px] text-[var(--muted)]">
          Assign a sprite sheet to edit collision shapes in Sprite Studio.
        </p>
      )}
    </div>
  )
}
