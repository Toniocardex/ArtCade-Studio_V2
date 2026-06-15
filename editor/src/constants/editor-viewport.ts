// ---------------------------------------------------------------------------
// editor-viewport — single source of truth for editor canvas chrome constants
// ---------------------------------------------------------------------------
//
// Zoom bounds, step sizes, snap factor, default grid, default scene size and
// the preset ladder used by ZoomControls all live here. Reducers, keyboard
// shortcuts, wheel handler and presets all import from this module so a
// future change to (say) the upper bound only happens in one place.

/** Lowest zoom factor allowed. 10% keeps text/handles readable. */
export const EDITOR_ZOOM_MIN = 0.1

/** Highest zoom factor. 800% supports pixel-level inspection on small sprites. */
export const EDITOR_ZOOM_MAX = 8.0

/** Identity zoom (Ctrl+0). Industry-standard meaning of "100%": 1 scene px = 1 device px. */
export const EDITOR_ZOOM_DEFAULT = 1.0

/**
 * Zoom level applied when the editor boots a blank project and on every
 * subsequent LOAD_PROJECT. Kept separate from EDITOR_ZOOM_DEFAULT so the
 * startup policy can change without altering the Ctrl+0 identity shortcut.
 */
export const EDITOR_BOOT_ZOOM = 1.0

/** Keyboard step (Ctrl+/-). 25% per press feels like Photoshop. */
export const EDITOR_ZOOM_KEYBOARD_STEP = 1.25

/** Ctrl+wheel exponential factor. 10% per notch keeps the feel linear at any zoom. */
export const EDITOR_ZOOM_WHEEL_FACTOR = 1.1

/**
 * Snap the clamped zoom to this many decimals before persisting. Prevents
 * floating-point drift from wheel zoom producing labels like "99.9999%".
 */
export const EDITOR_ZOOM_SNAP_DECIMALS = 3

/** Total canvas scroll-area padding across each axis (Tailwind p-2 = 8px × 2). */
export const EDITOR_CANVAS_PADDING_PX = 16

/** Default editor-only guide/snap grid size in world pixels. */
export const DEFAULT_EDITOR_GRID_SIZE = 32

/** Minimum / maximum editor grid size (the snap reducer clamps to this range). */
export const EDITOR_GRID_SIZE_MIN = 4
export const EDITOR_GRID_SIZE_MAX = 512

/**
 * Ruler tick spacing in world px (the world distance between two labelled
 * ruler marks). Independent of the grid. The ruler still auto-doubles this when
 * zoomed out so ticks never crowd below MIN_TICK_SCREEN_PX.
 */
export const DEFAULT_EDITOR_RULER_STEP = 64
export const EDITOR_RULER_STEP_MIN = 8
export const EDITOR_RULER_STEP_MAX = 1024

/**
 * Default scene size used for new blank projects and as fallback when no
 * scene is selected.
 *
 * 1280x640 is intentional, NOT 1280x720:
 *   • Both dimensions are exact multiples of every standard pixel-art tile
 *     size (8, 16, 32, 64, 128) — the default 32 px grid lays down 40×20
 *     perfect cells with no half-row at the bottom of the scene.
 *   • 2:1 aspect is the natural fit for platformers, top-down arcade games
 *     and side-scrollers (the genres ArtCade targets).
 *   • Width 1280 keeps HD-level horizontal resolution; height 640 trades the
 *     standard 720p vertical for grid alignment.
 *
 * If you change this, also re-check DEFAULT_EDITOR_GRID_SIZE: the invariant
 * "scene size MUST be a multiple of the default grid" is what makes the
 * editor look polished out of the box.
 */
export const DEFAULT_SCENE_SIZE = { x: 1280, y: 640 } as const

/** Default camera / viewport rectangle for new scenes (mockup: 512×320 inside world). */
export const DEFAULT_VIEWPORT_SIZE = { x: 512, y: 320 } as const

/**
 * Industry-standard zoom ladder (Photoshop / Aseprite / Affinity Designer).
 * Tight steps near 100% and wider at the extremes.
 */
export const ZOOM_PRESETS: readonly number[] = [
  0.10, 0.25, 0.50, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0,
] as const

/** Small epsilon used to compare zoom values without false equality misses. */
export const ZOOM_PRESET_EPSILON = 0.001
