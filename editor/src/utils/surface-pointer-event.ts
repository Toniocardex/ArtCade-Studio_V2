import { getPresentationSnapshot } from './presentation-store'

/**
 * Browser pointer sample tagged with presentation revision at capture time.
 * Mirrors C++ {@link SurfacePointerEvent} (ADR Phase 5 / PR6).
 */
export type SurfacePointerEvent = Readonly<{
  /** Viewport-local CSS position (padding edge, not framebuffer). */
  positionCss: Readonly<{ x: number; y: number }>
  presentationRevision: bigint
}>

/**
 * Captures a pointer sample and committed revisions at event time.
 * @param el viewport element used for local CSS coordinates
 * @param clientX browser client X
 * @param clientY browser client Y
 */
export function captureSurfacePointerEvent(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): SurfacePointerEvent {
  const rect = el.getBoundingClientRect()
  const snapshot = getPresentationSnapshot()
  return {
    positionCss: { x: clientX - rect.left, y: clientY - rect.top },
    presentationRevision: snapshot?.revision ?? 0n,
  }
}
