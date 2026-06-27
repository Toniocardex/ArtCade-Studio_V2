import { useEffect, useState } from 'react'
import type { EntityDef, ImageAsset } from '../../types'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import {
  fillColorToHex,
  hasSpriteImageAsset,
  hexToFillColor,
} from '../../utils/sprite-fill-color'
import { patchPrototypeSpriteColor } from '../../utils/prototype-sprite'
import { resolvePrototypeSpriteForInstance } from '../../utils/prototype-sprite-resolve'

export type SpriteFillColorFieldProps = Readonly<{
  entity: EntityDef
  linkedAsset?: ImageAsset
  isPrototype: boolean
}>

/**
 * Fill color for legacy placeholders, or prototype sprite base color when assigned
 * to a generated asset. Picker and hex edits stay local until Apply (or hex blur).
 */
export function SpriteFillColorField({
  entity,
  linkedAsset,
  isPrototype,
}: SpriteFillColorFieldProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const spriteRef = entity.sprite.spriteAssetId
  const disabled = hasSpriteImageAsset(spriteRef) && !isPrototype
  const protoView = isPrototype && project
    ? resolvePrototypeSpriteForInstance(project, entity.id)
    : null
  const colorSource = protoView?.baseColor ?? entity.sprite.fillColor
  const hex = fillColorToHex(colorSource)

  const [draft, setDraft] = useState(hex)

  useEffect(() => {
    setDraft(hex)
  }, [hex])

  const pendingFill = hexToFillColor(draft)
  const isDirty = pendingFill != null && fillColorToHex(pendingFill) !== hex

  function applyColor() {
    const fillColor = hexToFillColor(draft)
    if (!fillColor) {
      setDraft(hex)
      return
    }

    if (isPrototype) {
      const asset =
        (protoView?.assetId
          ? project?.assets?.[protoView.assetId]
          : undefined)
        ?? linkedAsset

      if (!asset) return

      dispatch({
        type: 'ASSET_ADD',
        asset: patchPrototypeSpriteColor(asset, fillColor),
      })
      return
    }

    dispatch({
      type: 'ENTITY_SET_SPRITE_FILL',
      entityId: entity.id,
      fillColor,
      coalesceKey: `fill:${entity.id}`,
    })
  }

  const label = isPrototype ? 'Prototype color' : 'Fill color (no asset)'

  return (
    <div className={`mb-2 ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-[11px] text-[var(--muted)] block mb-1">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          disabled={disabled}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-8 h-7 shrink-0 rounded border border-[var(--border-2)]
                     bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <input
          type="text"
          aria-label={`${label} hex`}
          disabled={disabled}
          value={draft}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={applyColor}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyColor()
          }}
          className="flex-1 min-w-0 text-xs font-mono uppercase text-[var(--text)]
                     bg-[var(--panel-3)] border border-[var(--border-2)] rounded px-2 py-1
                     outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled || !isDirty}
          onClick={applyColor}
          className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-[9px]
                     text-[var(--text)] hover:border-[var(--border-2)]
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
      {disabled ? (
        <p className="text-[8px] text-[var(--muted)] mt-1 leading-snug">
          Fill color applies only to placeholder objects without a sprite asset.
        </p>
      ) : isPrototype ? (
        <p className="text-[8px] text-[var(--muted)] mt-1 leading-snug">
          Edits the generated prototype color. Use Promote when ready for a real sprite file.
        </p>
      ) : null}
    </div>
  )
}
