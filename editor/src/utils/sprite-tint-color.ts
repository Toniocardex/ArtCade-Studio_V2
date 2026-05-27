import type { Vec4 } from '../types'

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function byteToHex(n: number): string {
  return Math.round(clamp01(n) * 255).toString(16).padStart(2, '0')
}

/** Map sprite tint RGB (0..1) to #rrggbb for color inputs. */
export function spriteTintToHex(tint: Vec4): string {
  return `#${byteToHex(tint.x)}${byteToHex(tint.y)}${byteToHex(tint.z)}`
}

/** Parse #rgb or #rrggbb; returns null if invalid. */
export function parseHexColor(raw: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(raw.trim())
  if (!m) return null
  let hex = m[1]
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  }
}

/** Apply hex RGB to tint; preserves tint.w (alpha channel on tint). */
export function spriteTintFromHex(tint: Vec4, hex: string): Vec4 | null {
  const rgb = parseHexColor(hex)
  if (!rgb) return null
  return { x: rgb.r, y: rgb.g, z: rgb.b, w: tint.w }
}

/** True when a sprite image path is assigned (fill color applies only without asset). */
export function hasSpriteImageAsset(spriteAssetId: string): boolean {
  return spriteAssetId.trim().length > 0
}

export function isDefaultSpriteTint(tint: Vec4): boolean {
  return (
    Math.abs(tint.x - 1) < 0.004
    && Math.abs(tint.y - 1) < 0.004
    && Math.abs(tint.z - 1) < 0.004
  )
}
