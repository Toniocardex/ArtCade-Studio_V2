import type { Vec3 } from '../types'

export const DEFAULT_FILL_COLOR: Vec3 = { x: 1, y: 1, z: 1 }

export function hasSpriteImageAsset(spriteAssetId: string): boolean {
  return spriteAssetId.trim().length > 0
}

export function fillColorToHex(fill: Vec3): string {
  const byte = (n: number) =>
    Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0')
  return `#${byte(fill.x)}${byte(fill.y)}${byte(fill.z)}`
}

/**
 * Parses a 6-digit hex color (with or without leading '#') into a normalized
 * fill color. Returns null for malformed input so callers can keep the prior
 * value while the user is still typing.
 */
export function hexToFillColor(hex: string): Vec3 | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!match) return null
  const int = Number.parseInt(match[1], 16)
  return {
    x: ((int >> 16) & 0xff) / 255,
    y: ((int >> 8) & 0xff) / 255,
    z: (int & 0xff) / 255,
  }
}
