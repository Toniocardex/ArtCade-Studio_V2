// ---------------------------------------------------------------------------
// text-anchor — single source of truth for the Text label 3×3 anchor grid
// ---------------------------------------------------------------------------
//
// The Text label anchors against the entity position with the same 9-point grid
// as the sprite pivot, but expressed as a readable textual enum (no separate
// Vec2 pivot duplicated for text). The dropdown in the Inspector and the
// Logic Board `text.align` value source both read from the lists below.
//
// Canonical naming: "{vertical}-{horizontal}", where the dead-centre anchor
// collapses to the single word "center". Horizontal band: left/center/right;
// vertical band: top/center/bottom.
//
// The C++ renderer mirrors this mapping in app_scene_render.cpp (textAnchorAlign):
// keep the two in sync. Legacy projects stored a horizontal-only value
// ('left' | 'center' | 'right'); the C++ parser keeps accepting those.

export type TextAnchor =
  | 'top-left'    | 'top-center'    | 'top-right'
  | 'center-left' | 'center'        | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

/** Row-major order (top→bottom, left→right) so it lays out as a 3×3 grid. */
export const TEXT_ANCHORS: readonly TextAnchor[] = [
  'top-left',    'top-center',    'top-right',
  'center-left', 'center',        'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
] as const

/** Human labels, index-aligned with {@link TEXT_ANCHORS}. */
export const TEXT_ANCHOR_LABELS: readonly string[] = [
  'Top-left',    'Top-center',    'Top-right',
  'Center-left', 'Center',        'Center-right',
  'Bottom-left', 'Bottom-center', 'Bottom-right',
] as const

export const DEFAULT_TEXT_ANCHOR: TextAnchor = 'top-left'
