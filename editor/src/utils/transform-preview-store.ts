// ---------------------------------------------------------------------------
// transform-preview-store — ephemeral Inspector values during canvas drag
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from 'react'
import type { EntityTransformSnapshot } from './runtime-sync-service'

type Listener = () => void

const previews = new Map<number, EntityTransformSnapshot>()
const listeners = new Map<number, Set<Listener>>()

let pendingPreview: EntityTransformSnapshot | null = null
let previewRaf: number | null = null

/**
 * Publish a live transform snapshot for Inspector display only.
 * Does not touch ProjectDoc, history, or runtime sync.
 */
export function publishTransformPreview(
  snapshot: EntityTransformSnapshot,
): void {
  const previous = previews.get(snapshot.entityId)

  if (
    previous
    && previous.x === snapshot.x
    && previous.y === snapshot.y
    && previous.rotation === snapshot.rotation
    && previous.scaleX === snapshot.scaleX
    && previous.scaleY === snapshot.scaleY
  ) {
    return
  }

  previews.set(snapshot.entityId, snapshot)

  for (const listener of listeners.get(snapshot.entityId) ?? []) {
    listener()
  }
}

/** Coalesce high-frequency C++ preview callbacks to one React update per frame. */
export function queueTransformPreview(
  snapshot: EntityTransformSnapshot,
): void {
  pendingPreview = snapshot

  if (previewRaf !== null) return

  previewRaf = requestAnimationFrame(() => {
    previewRaf = null

    const next = pendingPreview
    pendingPreview = null

    if (next) {
      publishTransformPreview(next)
    }
  })
}

export function clearTransformPreview(entityId: number): void {
  if (!previews.delete(entityId)) return

  for (const listener of listeners.get(entityId) ?? []) {
    listener()
  }
}

function subscribe(entityId: number, listener: Listener): () => void {
  let entityListeners = listeners.get(entityId)

  if (!entityListeners) {
    entityListeners = new Set()
    listeners.set(entityId, entityListeners)
  }

  entityListeners.add(listener)

  return () => {
    entityListeners?.delete(listener)

    if (entityListeners?.size === 0) {
      listeners.delete(entityId)
    }
  }
}

/** Live canvas drag values for the selected entity; null when not dragging. */
export function useTransformPreview(
  entityId: number,
): EntityTransformSnapshot | null {
  return useSyncExternalStore(
    (listener) => subscribe(entityId, listener),
    () => previews.get(entityId) ?? null,
    () => null,
  )
}
