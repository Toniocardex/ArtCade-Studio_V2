import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { PivotPresetFields } from '../../components/pivot/PivotPresetFields'
import {
  findImageAssetByPath,
  resolveEffectivePivot,
  spriteAssignedFromAsset,
  spriteInheritingAssetPivot,
  spriteWithPivotOverride,
  usesAssetPivot,
} from '../../utils/sprite-pivot-resolve'
import { formatPivotLabel } from '../../utils/sprite-pivot'
import { InspectorSection, NumberField } from './inspector-fields'
import { SpriteRayTintField } from './SpriteRayTintField'

export type SpriteSectionProps = Readonly<{
  entity: EntityDef
}>

export function SpriteSection({ entity }: SpriteSectionProps) {
  const { state, dispatch } = useEditor()
  const project = state.project
  const images = Object.values(project?.assets ?? {})
  const assetSelectId = `${entity.id}-sprite-asset`
  const [overrideOpen, setOverrideOpen] = useState(false)

  const linkedAsset = findImageAssetByPath(project?.assets, entity.sprite.spriteAssetId)
  const effectivePivot = resolveEffectivePivot(entity.sprite, project?.assets)
  const fromAsset = usesAssetPivot(entity.sprite)

  function commitSprite(patch: Partial<EntityDef['sprite']>) {
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: entity.id,
      sprite: { ...entity.sprite, ...patch },
    })
  }

  const pivotSummary = fromAsset
    ? `From sheet — ${formatPivotLabel(effectivePivot)}`
    : `Override — ${formatPivotLabel(entity.sprite.pivot)}`

  return (
    <InspectorSection label="Sprite">
      <div className="mb-2">
        <label htmlFor={assetSelectId} className="text-[9px] text-[var(--muted)] uppercase">
          Asset
        </label>
        <select
          id={assetSelectId}
          value={entity.sprite.spriteAssetId}
          onChange={(e) => {
            const path = e.target.value
            const img = images.find((a) => a.path === path)
            commitSprite(spriteAssignedFromAsset(entity.sprite, img))
          }}
          className="w-full bg-[var(--panel-3)] border border-[var(--border-2)] rounded px-2 py-1
                     text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-2)] transition-colors"
        >
          <option value="">(none)</option>
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

      <div className="mb-2 rounded border border-[var(--border)] bg-[var(--panel-3)] p-2">
        <p className="text-[9px] text-[var(--muted)] uppercase mb-1">Pivot</p>
        <p className="text-[10px] text-[var(--text)] mb-2">{pivotSummary}</p>
        {fromAsset && linkedAsset ? (
          <p className="text-[8px] text-[var(--muted)] mb-2 leading-snug">
            Edit the default on this sheet in Sprite Studio.
          </p>
        ) : null}
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-[var(--accent)] w-full text-left"
          aria-expanded={overrideOpen}
          onClick={() => setOverrideOpen((o) => !o)}
        >
          {overrideOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Override pivot (advanced)
        </button>
        {overrideOpen ? (
          <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-2">
            <PivotPresetFields
              pivot={fromAsset ? effectivePivot : entity.sprite.pivot}
              onChange={(pivot) => commitSprite(spriteWithPivotOverride(entity.sprite, pivot))}
              compact
            />
            {!fromAsset ? (
              <button
                type="button"
                className="text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                onClick={() => commitSprite(spriteInheritingAssetPivot(entity.sprite))}
              >
                Reset to sheet default
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </InspectorSection>
  )
}
