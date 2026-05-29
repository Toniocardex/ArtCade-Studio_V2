/** Minimum time splash branding stays visible (classic splash — never instant dismiss). */
export const SPLASH_MIN_VISIBLE_MS = 2500

/** Pure boot-gate conditions (testable without mounting React). */

export function shouldStartBootFade(opts: Readonly<{
  ready: boolean
  introComplete: boolean
  bootComplete: boolean
  fadeOut: boolean
  nowMs: number
  splashStartedAtMs: number
}>): boolean {
  if (!opts.ready || !opts.introComplete || opts.bootComplete || opts.fadeOut) return false
  return opts.nowMs - opts.splashStartedAtMs >= SPLASH_MIN_VISIBLE_MS
}

export function shouldShowBootLoadingStatus(opts: Readonly<{
  introComplete: boolean
  ready: boolean
  timedOut: boolean
}>): boolean {
  return opts.introComplete && !opts.ready && !opts.timedOut
}
