/** Intro plays through title hold; gate may dismiss after this (full animation path). */
export const SPLASH_INTRO_HOLD_MS = 4800

/** After skip, wait for title frame paint before intro counts complete. */
export const SPLASH_SKIP_INTRO_COMPLETE_MS = 400

/** Never dismiss before this elapsed — matches intro hold for a classic splash. */
export const SPLASH_MIN_VISIBLE_MS = SPLASH_INTRO_HOLD_MS

export const SPLASH_STEP_DELAYS_MS = {
  grid: 200,
  streams: 600,
  title: 1400,
} as const
