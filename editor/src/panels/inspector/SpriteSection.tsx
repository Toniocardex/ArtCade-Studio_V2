import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { PivotPresetFields } from '../../components/pivot/PivotPresetFields'
import { resolveClipForEntity } from '../../utils/entity-clip-resolve'
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
import { InspectorClipPreview } from './InspectorClipPreview'
import { SpriteRayTintField } from './SpriteRayTintField'
import { EditorSelect } from '../../components/ui/EditorSelect'

export type SpriteSectionProps = Readonly<{
  entity: EntityDef
}>

export function SpriteSection({ entity }: SpriteSectionProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const images = Object.values(project?.assets ?? {}).filter((asset) => asset.usage === 'sprite')
  const assetSelectId = `${entity.id}-sprite-asset`
  const [overrideOpen, setOverrideOpen] = useState(false)

  const clip = useMemo(
    () => resolveClipForEntity(project, entity.id, entity),
    [project, entity],
  )
  const spritePath = clip?.spritePath ?? entity.sprite.spriteAssetId
  const linkedAsset = findImageAssetByPath(project?.assets, spritePath)
  const sheetClips = clip?.clips ?? []
  const effectivePivot = resolveEffectivePivot(entity.sprite, project?.assets)
  const fromAsset = usesAssetPivot(entity.sprite)
  const defaultClipId = `${entity.id}-default-clip`
  const playOnSpawnId = `${entity.id}-play-clip-on-spawn`

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
        <EditorSelect
          id={assetSelectId}
          value={entity.sprite.spriteAssetId}
          onChange={(path) => {
            const img = images.find((a) => a.path === path)
            commitSprite(spriteAssignedFromAsset(entity.sprite, img, project))
          }}
          triggerClassName="py-1"
          options={[
            { value: '', label: '(none)' },
            // Keep a missing asset path selectable so the field shows the truth.
            ...(entity.sprite.spriteAssetId &&
            !images.some((a) => a.path === entity.sprite.spriteAssetId)
              ? [{ value: entity.sprite.spriteAssetId, label: entity.sprite.spriteAssetId }]
              : []),
            ...images.map((a) => ({ value: a.path, label: a.name })),
          ]}
        />
        {images.length === 0 && (
          <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] mt-0.5">
            Import images in the ASSETS panel, then pick one here.
          </p>
        )}
      </div>

      <div className="mb-2">
        <label htmlFor={defaultClipId} className="text-[9px] text-[var(--muted)] uppercase">
          Default clip
        </label>
        <EditorSelect
          id={defaultClipId}
          disabled={!spritePath || sheetClips.length === 0}
          value={clip?.defaultClip ?? entity.sprite.defaultClip ?? ''}
          onChange={(name) => {
            const defaultClip = name || undefined
            commitSprite({
              defaultClip,
              playClipOnSpawn: defaultClip ? entity.sprite.playClipOnSpawn === true : false,
            })
          }}
          className="mt-1 w-full"
          triggerClassName="py-1"
          options={[
            { value: '', label: '(none)' },
            ...sheetClips.map((c) => ({ value: c.name, label: c.name })),
          ]}
        />
        {!spritePath ? (
          <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] mt-0.5">
            Assign a sprite sheet first.
          </p>
        ) : sheetClips.length === 0 ? (
          <p className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] mt-0.5">
            Open Sprite Studio on this sheet to add clips.
          </p>
        ) : null}
        {linkedAsset && clip?.defaultClip ? (
          <InspectorClipPreview asset={linkedAsset} clipName={clip.defaultClip} />
        ) : null}
      </div>

      <label
        htmlFor={playOnSpawnId}
        className={`flex items-center gap-2 text-[10px] mb-2 ${
          clip?.defaultClip ? 'text-[var(--text)]' : 'text-[var(--muted)]'
        }`}
      >
        <input
          id={playOnSpawnId}
          type="checkbox"
          disabled={!clip?.defaultClip}
          checked={entity.sprite.playClipOnSpawn === true}
          onChange={(e) => commitSprite({ playClipOnSpawn: e.target.checked })}
        />
        Play on spawn
      </label>
      {entity.sprite.playClipOnSpawn && clip?.defaultClip ? (
        <p className="text-[8px] text-[var(--muted)] mb-2 leading-snug -mt-1">
          Starts this clip when the entity enters play without a Logic Board rule. Logic Board can still call Play animation.
        </p>
      ) : null}

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
          className="flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--text)] w-full text-left"
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
