// ---------------------------------------------------------------------------
// editor-layout-tier — breakpoint resolution (docs/ADAPTIVE_LAYOUT.md §5)
// ---------------------------------------------------------------------------

export type LayoutTier = 'full' | 'compact' | 'minimal' | 'unsupported'

export function resolveLayoutTier(width: number, height: number): LayoutTier {
  if (width < 1024 || height < 600) return 'unsupported'
  if (width < 1280 || height < 680) return 'minimal'
  if (width < 1600 || height < 900) return 'compact'
  return 'full'
}
