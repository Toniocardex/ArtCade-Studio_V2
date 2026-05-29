import { SPLASH_MIN_VISIBLE_MS } from './splash-choreography'

export { SPLASH_MIN_VISIBLE_MS }

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
  ready: boolean
  timedOut: boolean
}>): boolean {
  return !opts.ready && !opts.timedOut
}

/** Skip is allowed only after full boot readiness; one-shot after click. */
export function canSkipBootIntro(opts: Readonly<{
  ready: boolean
  introSkipped: boolean
}>): boolean {
  return opts.ready && !opts.introSkipped
}
