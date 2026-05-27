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
