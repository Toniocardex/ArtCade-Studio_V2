import type { PresentationChangedEvent, PresentationSnapshot } from './presentation-snapshot'

let committed: PresentationSnapshot | null = null
const listeners = new Set<(event: PresentationChangedEvent) => void>()

/**
 * Last committed presentation snapshot from the WASM runtime (revision-aligned).
 */
export function getPresentationSnapshot(): PresentationSnapshot | null {
  return committed
}

/**
 * Publishes a {@link PresentationChangedEvent} when revision advances.
 * @returns true when listeners were notified
 */
export function publishPresentationSnapshot(snapshot: PresentationSnapshot): boolean {
  if (committed !== null && committed.revision === snapshot.revision) return false
  committed = snapshot
  const event: PresentationChangedEvent = { revision: snapshot.revision, snapshot }
  for (const listener of listeners) listener(event)
  return true
}

/** Subscribe to presentation commits (rulers, play CSS, zoom readouts). */
export function onPresentationChanged(
  listener: (event: PresentationChangedEvent) => void,
): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Drops the committed snapshot (e.g. before a new play session). Listeners stay subscribed. */
export function clearPresentationSnapshot(): void {
  committed = null
}

/** Test helper — clears store state. */
export function resetPresentationStoreForTests(): void {
  clearPresentationSnapshot()
  listeners.clear()
}
