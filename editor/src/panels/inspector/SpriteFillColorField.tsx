import { useEffect, useRef, useState } from 'react'
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

const HEX_PATTERN = /^#?[0-9a-fA-F]{6}$/

/**
 * Fill color for legacy placeholders, or prototype sprite base color when assigned
 * to a generated asset.
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
  const editingRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) setDraft(hex)
  }, [hex])

  function commit(nextHex: string) {
    const fillColor = hexToFillColor(nextHex)
    if (!fillColor) return
    if (isPrototype) {
      const asset =
        (protoView?.assetId ? project?.assets?.[protoView.assetId] : undefined)
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

  function onPickerChange(value: string) {
    setDraft(value)
    commit(value)
  }

  function onHexInput(value: string) {
    editingRef.current = true
    setDraft(value)
    if (HEX_PATTERN.test(value)) commit(value)
  }

  function onHexBlur() {
    editingRef.current = false
    if (HEX_PATTERN.test(draft)) commit(draft)
    else setDraft(hex)
  }

  const label = isPrototype ? 'Prototype color' : 'Fill color (no asset)'

  return (
    <div className={`mb-2 ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-[9px] text-[var(--muted)] uppercase block mb-1">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          disabled={disabled}
          value={hex}
          onChange={(e) => onPickerChange(e.target.value)}
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
          onChange={(e) => onHexInput(e.target.value)}
          onBlur={onHexBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="flex-1 min-w-0 text-xs font-mono uppercase text-[var(--text)]
                     bg-[var(--panel-3)] border border-[var(--border-2)] rounded px-2 py-1
                     outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed"
        />
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
