import { useEffect, useState } from 'react'
import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import {
  hasSpriteImageAsset,
  isDefaultSpriteTint,
  parseHexColor,
  spriteTintFromHex,
  spriteTintToHex,
} from '../../utils/sprite-tint-color'

export function SpriteFillColorField({ entity }: { entity: EntityDef }) {
  const { dispatch } = useEditor()
  const disabled = hasSpriteImageAsset(entity.sprite.spriteAssetId)
  const [hexDraft, setHexDraft] = useState(() => spriteTintToHex(entity.sprite.tint))

  useEffect(() => {
    setHexDraft(spriteTintToHex(entity.sprite.tint))
  }, [entity.id, entity.sprite.tint.x, entity.sprite.tint.y, entity.sprite.tint.z])

  function commitTint(nextHex: string) {
    if (disabled) return
    const normalized = nextHex.startsWith('#') ? nextHex : `#${nextHex}`
    const nextTint = spriteTintFromHex(entity.sprite.tint, normalized)
    if (!nextTint) return
    setHexDraft(spriteTintToHex(nextTint))
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: entity.id,
      sprite: { ...entity.sprite, tint: nextTint },
    })
  }

  function resetTint() {
    if (disabled) return
    const next = { x: 1, y: 1, z: 1, w: entity.sprite.tint.w }
    setHexDraft(spriteTintToHex(next))
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: entity.id,
      sprite: { ...entity.sprite, tint: next },
    })
  }

  const pickerHex = spriteTintToHex(entity.sprite.tint)

  return (
    <div className={`mb-2 ${disabled ? 'opacity-50' : ''}`}>
      <label className="text-[9px] text-[var(--muted)] uppercase block mb-1">
        Fill color (no asset)
      </label>
      <p className="text-[9px] text-[var(--muted)] leading-snug mb-1.5">
        {disabled
          ? 'Clear Sprite → Asset to (none) to set a prototype fill color. The assigned image is used instead.'
          : 'Solid placeholder color in preview when no sprite image is selected.'}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerHex}
          disabled={disabled}
          aria-label="Sprite fill color"
          onChange={(e) => commitTint(e.target.value)}
          className="w-8 h-7 shrink-0 bg-transparent border border-[var(--border-2)] rounded cursor-pointer disabled:cursor-not-allowed"
        />
        <input
          type="text"
          value={hexDraft}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => {
            if (disabled) return
            if (parseHexColor(hexDraft)) commitTint(hexDraft)
            else setHexDraft(spriteTintToHex(entity.sprite.tint))
          }}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'Enter') {
              e.preventDefault()
              if (parseHexColor(hexDraft)) commitTint(hexDraft)
              else setHexDraft(spriteTintToHex(entity.sprite.tint))
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="flex-1 min-w-0 bg-[var(--panel-3)] border border-[var(--border-2)] rounded px-2 py-1
                     text-xs text-[var(--text)] font-mono uppercase focus:outline-none focus:border-[var(--accent-2)]
                     disabled:cursor-not-allowed"
        />
        {!disabled && !isDefaultSpriteTint(entity.sprite.tint) && (
          <button
            type="button"
            title="Reset to white"
            onClick={resetTint}
            className="text-[9px] px-2 py-1 rounded border border-[var(--border-2)]
                       text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent-2)]"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
