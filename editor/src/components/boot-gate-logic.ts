/** Pure boot-gate conditions (testable without mounting React). */

export function shouldStartBootFade(opts: Readonly<{
  ready: boolean
  introDone: boolean
  bootComplete: boolean
  fadeOut: boolean
}>): boolean {
  return opts.ready && opts.introDone && !opts.bootComplete && !opts.fadeOut
}

export function shouldShowBootLoadingStatus(opts: Readonly<{
  introDone: boolean
  ready: boolean
  timedOut: boolean
}>): boolean {
  return opts.introDone && !opts.ready && !opts.timedOut
}
