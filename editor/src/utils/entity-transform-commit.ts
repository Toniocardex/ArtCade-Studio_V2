// ---------------------------------------------------------------------------
// entity-transform-commit — single orchestration for inspector + canvas commits
// ---------------------------------------------------------------------------

import type { Dispatch, MutableRefObject } from 'react'
import type { Action } from '../store/editor-store-state'
import type { EntityDef } from '../types'
import { normalizeEntityPosition } from './entity-position'
import { runtimeSync, type EntityTransformSnapshot } from './runtime-sync-service'
export type { EntityTransformSnapshot } from './runtime-sync-service'

const TRANSFORM_EPSILON = 1e-4

function normalizeScale(value: number): number {
  if (!Number.isFinite(value)) return 1

  const sign = value < 0 ? -1 : 1
  return sign * Math.max(1, Math.round(Math.abs(value)))
}

export type TransformSource = 'inspector' | 'canvas'

export type TransformPatch = Partial<{
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}>

/**
 * Build a transform snapshot from an entity plus optional field overrides.
 */
export function transformSnapshotFromEntity(
  entity: EntityDef,
  patch: TransformPatch = {},
): EntityTransformSnapshot {
  return {
    entityId: entity.id,
    x: patch.x ?? entity.transform.position.x,
    y: patch.y ?? entity.transform.position.y,
    rotation: patch.rotation ?? entity.transform.rotation,
    scaleX: patch.scaleX ?? entity.transform.scale.x,
    scaleY: patch.scaleY ?? entity.transform.scale.y,
  }
}

/** Compare transform snapshots within editor/runtime epsilon. */
export function transformSnapshotsEqual(
  a: EntityTransformSnapshot,
  b: EntityTransformSnapshot,
): boolean {
  return a.entityId === b.entityId
    && Math.abs(a.x - b.x) < TRANSFORM_EPSILON
    && Math.abs(a.y - b.y) < TRANSFORM_EPSILON
    && Math.abs(a.rotation - b.rotation) < TRANSFORM_EPSILON
    && Math.abs(a.scaleX - b.scaleX) < TRANSFORM_EPSILON
    && Math.abs(a.scaleY - b.scaleY) < TRANSFORM_EPSILON
}

/**
 * Normalize, persist, and sync one entity transform commit.
 * Inspector always pushes to WASM; canvas drag-end notes when runtime already owns the value.
 */
export function commitEntityTransform(options: {
  dispatch: Dispatch<Action>
  snapshot: EntityTransformSnapshot
  source: TransformSource
  snapToGrid: boolean
  gridSize: number
  /** Skip dispatch/runtime when the committed transform matches the entity. */
  entity?: EntityDef
  /** When canvas snap corrects position, ignore the runtime echo of that value. */
  ignoreRuntimeEchoRef?: MutableRefObject<EntityTransformSnapshot | null>
}): EntityTransformSnapshot | null {
  const {
    dispatch,
    snapshot,
    source,
    snapToGrid,
    gridSize,
    ignoreRuntimeEchoRef,
  } = options

  const position = normalizeEntityPosition(
    snapshot.x,
    snapshot.y,
    snapToGrid,
    gridSize,
  )

  const committed: EntityTransformSnapshot = {
    ...snapshot,
    x: position.x,
    y: position.y,
    scaleX: normalizeScale(snapshot.scaleX),
    scaleY: normalizeScale(snapshot.scaleY),
  }

  if (options.entity) {
    const current = transformSnapshotFromEntity(options.entity)
    if (transformSnapshotsEqual(committed, current)) {
      return null
    }
  }

  dispatch({
    type: 'UPDATE_ENTITY_TRANSFORM',
    entityId: committed.entityId,
    x: committed.x,
    y: committed.y,
    rotation: committed.rotation,
    scaleX: committed.scaleX,
    scaleY: committed.scaleY,
  })

  const snapCorrected =
    committed.x !== snapshot.x || committed.y !== snapshot.y

  if (source === 'canvas' && !snapCorrected) {
    runtimeSync.noteTransform(committed)
  } else {
    if (source === 'canvas' && snapCorrected && ignoreRuntimeEchoRef) {
      ignoreRuntimeEchoRef.current = committed
    }
    runtimeSync.syncEntityTransform(committed)
  }

  return committed
}

/**
 * Returns true when `incoming` is the runtime echo of a canvas snap correction
 * already committed (see `ignoreRuntimeEchoRef` on commitEntityTransform).
 */
export function consumeRuntimeTransformEcho(
  ignoreRuntimeEchoRef: MutableRefObject<EntityTransformSnapshot | null>,
  incoming: EntityTransformSnapshot,
): boolean {
  if (
    ignoreRuntimeEchoRef.current
    && transformSnapshotsEqual(ignoreRuntimeEchoRef.current, incoming)
  ) {
    ignoreRuntimeEchoRef.current = null
    return true
  }
  return false
}
