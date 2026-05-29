import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import {
  clampPivot,
  activePresetId,
  formatPivotLabel,
  PIVOT_PRESETS,
} from '../../utils/sprite-pivot'
import { InspectorSection, NumberField } from './inspector-fields'
import { SpriteRayTintField } from './SpriteRayTintField'

export type SpriteSectionProps = Readonly<{
  entity: EntityDef
}>

export function SpriteSection({ entity }: SpriteSectionProps) {
  const { state, dispatch } = useEditor()
  const images = Object.values(state.project?.assets ?? {})
  const assetSelectId = `${entity.id}-sprite-asset`

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
        <label htmlFor={assetSelectId} className="text-[9px] text-[var(--muted)] uppercase">
          Asset
        </label>
        <select
          id={assetSelectId}
          value={entity.sprite.spriteAssetId}
          onChange={(e) => commitSprite({ spriteAssetId: e.target.value })}
          className="w-full bg-[var(--panel-3)] border border-[var(--border-2)] rounded px-2 py-1
                     text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)] transition-colors"
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
      <SpriteRayTintField entity={entity} />
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
      <div className="mb-2">
        <p className="text-[9px] text-[var(--muted)] uppercase mb-1">
          Pivot — {formatPivotLabel(entity.sprite.pivot)}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <NumberField
            label="Pivot X"
            value={entity.sprite.pivot.x}
            onCommit={(v) =>
              commitSprite({ pivot: clampPivot({ ...entity.sprite.pivot, x: v }) })
            }
          />
          <NumberField
            label="Pivot Y"
            value={entity.sprite.pivot.y}
            onCommit={(v) =>
              commitSprite({ pivot: clampPivot({ ...entity.sprite.pivot, y: v }) })
            }
          />
        </div>
        <div
          className="grid grid-cols-3 gap-1 mb-1"
          role="group"
          aria-label="Pivot presets"
        >
          {PIVOT_PRESETS.map((preset) => {
            const active = activePresetId(entity.sprite.pivot) === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={active}
                onClick={() => commitSprite({ pivot: { ...preset.pivot } })}
                className={`h-6 rounded text-[9px] font-semibold border transition-colors
                  ${active
                    ? 'border-[var(--accent-2)] bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent-bd)]'
                  }`}
              >
                {preset.id.toUpperCase()}
              </button>
            )
          })}
        </div>
        <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.7)] leading-snug">
          Transform position is the pivot point on the sprite.
        </p>
      </div>
    </InspectorSection>
  )
}
