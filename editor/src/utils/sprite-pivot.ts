import type { Vec2 } from '../types'

export const DEFAULT_PIVOT: Vec2 = { x: 0.5, y: 0.5 }

export interface PivotPreset {
  id: string
  label: string
  pivot: Vec2
}

export const PIVOT_PRESETS: readonly PivotPreset[] = [
  { id: 'tl', label: 'Top-left', pivot: { x: 0, y: 0 } },
  { id: 'tc', label: 'Top-center', pivot: { x: 0.5, y: 0 } },
  { id: 'tr', label: 'Top-right', pivot: { x: 1, y: 0 } },
  { id: 'ml', label: 'Middle-left', pivot: { x: 0, y: 0.5 } },
  { id: 'c', label: 'Center', pivot: { x: 0.5, y: 0.5 } },
  { id: 'mr', label: 'Middle-right', pivot: { x: 1, y: 0.5 } },
  { id: 'bl', label: 'Bottom-left', pivot: { x: 0, y: 1 } },
  { id: 'bc', label: 'Bottom-center', pivot: { x: 0.5, y: 1 } },
  { id: 'br', label: 'Bottom-right', pivot: { x: 1, y: 1 } },
] as const

const PIVOT_EPS = 0.001

export function clampPivot(v: Vec2): Vec2 {
  return {
    x: Math.min(1, Math.max(0, v.x)),
    y: Math.min(1, Math.max(0, v.y)),
  }
}

export function pivotsEqual(a: Vec2, b: Vec2): boolean {
  return Math.abs(a.x - b.x) < PIVOT_EPS && Math.abs(a.y - b.y) < PIVOT_EPS
}

export function formatPivotLabel(p: Vec2): string {
  const preset = PIVOT_PRESETS.find((pr) => pivotsEqual(pr.pivot, p))
  if (preset) return preset.label
  return `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`
}

export function activePresetId(p: Vec2): string | null {
  const preset = PIVOT_PRESETS.find((pr) => pivotsEqual(pr.pivot, p))
  return preset?.id ?? null
}
