import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { InspectorSection, NumberField } from './inspector-fields'

export function SpriteSection({ entity }: { entity: EntityDef }) {
  const { state, dispatch } = useEditor()
  const images = Object.values(state.project?.assets ?? {})

  function commitSprite(patch: Partial<EntityDef['sprite']>) {
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: entity.id,
      sprite: { ...entity.sprite, ...patch },
    })
  }

  return (
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
  )
}
