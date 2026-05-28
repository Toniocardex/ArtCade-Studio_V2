import type { EntityDef } from '../../types'
import { editorOpenRayTint, isReady } from '../../utils/wasm-bridge'
import {
  fillColorToHex,
  hasSpriteImageAsset,
} from '../../utils/sprite-fill-color'

export type SpriteRayTintFieldProps = Readonly<{
  entity: EntityDef
}>

export function SpriteRayTintField({ entity }: SpriteRayTintFieldProps) {
  const disabled = hasSpriteImageAsset(entity.sprite.spriteAssetId)
  const hex = fillColorToHex(entity.sprite.fillColor)

  function openPicker() {
    if (disabled || !isReady()) return
    editorOpenRayTint(entity.id)
  }

  return (
    <div className={`mb-2 ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-[9px] text-[var(--muted)] uppercase block mb-1">
        Fill color (no asset)
      </span>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-7 shrink-0 rounded border border-[var(--border-2)]"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <span className="flex-1 min-w-0 text-xs font-mono uppercase text-[var(--text)]">
          {hex}
        </span>
        <button
          type="button"
          disabled={disabled || !isReady()}
          onClick={openPicker}
          className="text-[9px] px-2 py-1 rounded border border-[var(--border-2)]
                     text-[var(--text)] hover:border-[var(--accent-2)] disabled:cursor-not-allowed
                     disabled:opacity-60"
        >
          Sprite color
        </button>
      </div>
    </div>
  )
}
