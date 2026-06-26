/**
 * TypeScript mirror of {@link PresentationSnapshotWasm} (96-byte flat ABI v2).
 * React overlays read this store — no independent fit/letterbox math (ADR Phase 5).
 */

export const PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE = 96
export const PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE_V1 = 64
export const PRESENTATION_SNAPSHOT_ABI_VERSION = 2

export type PresentationMode =
  | 'sceneEdit'
  | 'cameraPreview'
  | 'playEmbedded'
  | 'playExternal'
  | 'playFullscreen'

const MODE_FROM_ABI: readonly PresentationMode[] = [
  'sceneEdit',
  'cameraPreview',
  'playEmbedded',
  'playExternal',
  'playFullscreen',
]

/** WASM {@link PresentationMode} ordinal for `editor_set_play_presentation`. */
export const PRESENTATION_MODE_ABI: Record<PresentationMode, number> = {
  sceneEdit: 0,
  cameraPreview: 1,
  playEmbedded: 2,
  playExternal: 3,
  playFullscreen: 4,
}

export type PresentationPlacement = Readonly<{
  destX: number
  destY: number
  destW: number
  destH: number
  scaleX: number
  scaleY: number
}>

export type VisibleWorldBounds = Readonly<{
  minX: number
  minY: number
  maxX: number
  maxY: number
}>

/** Committed presentation snapshot consumed by React overlays. */
export type PresentationSnapshot = Readonly<{
  revision: bigint
  effectiveMode: PresentationMode
  letterboxActive: boolean
  useIdentityPlacement: boolean
  surfaceFramebuffer: Readonly<{ width: number; height: number }>
  logical: Readonly<{ width: number; height: number }>
  placement: PresentationPlacement
  presentationScale: number
  editorViewOrigin: Readonly<{ x: number; y: number }>
  surfacePixelsPerWorldUnit: number
  visibleWorldBounds: VisibleWorldBounds
}>

export type PresentationChangedEvent = Readonly<{
  revision: bigint
  snapshot: PresentationSnapshot
}>

function parsePlacementV1(view: DataView, base: number): PresentationPlacement {
  const scaleX = view.getFloat32(base + 56, true)
  return {
    destX: view.getFloat32(base + 40, true),
    destY: view.getFloat32(base + 44, true),
    destW: view.getFloat32(base + 48, true),
    destH: view.getFloat32(base + 52, true),
    scaleX,
    scaleY: view.getFloat32(base + 60, true),
  }
}

/** Pre-v1 WASM layout (revision at byte 0, no abi header). */
function parseLegacyPresentationSnapshotWasm(
  heap: Uint8Array,
  ptr: number,
): PresentationSnapshot {
  const view = new DataView(heap.buffer, heap.byteOffset + ptr, 60)
  const revision = view.getBigUint64(0, true)
  const modeOrdinal = view.getUint32(8, true)
  const effectiveMode = MODE_FROM_ABI[modeOrdinal] ?? 'sceneEdit'
  const flags = view.getUint32(12, true)
  const scaleX = view.getFloat32(48, true)
  return {
    revision,
    effectiveMode,
    letterboxActive: (flags & 1) !== 0,
    useIdentityPlacement: (flags & 2) !== 0,
    surfaceFramebuffer: {
      width: view.getFloat32(16, true),
      height: view.getFloat32(20, true),
    },
    logical: {
      width: view.getFloat32(24, true),
      height: view.getFloat32(28, true),
    },
    placement: {
      destX: view.getFloat32(32, true),
      destY: view.getFloat32(36, true),
      destW: view.getFloat32(40, true),
      destH: view.getFloat32(44, true),
      scaleX,
      scaleY: view.getFloat32(52, true),
    },
    presentationScale: view.getFloat32(56, true) || scaleX,
    editorViewOrigin: { x: 0, y: 0 },
    surfacePixelsPerWorldUnit: scaleX,
    visibleWorldBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  }
}

function parsePresentationSnapshotV1(heap: Uint8Array, ptr: number): PresentationSnapshot {
  const view = new DataView(heap.buffer, heap.byteOffset + ptr, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE_V1)
  const revision = view.getBigUint64(8, true)
  const modeOrdinal = view.getUint32(16, true)
  const effectiveMode = MODE_FROM_ABI[modeOrdinal]
  if (!effectiveMode) {
    throw new Error(`Unsupported presentation mode ABI: ${modeOrdinal}`)
  }
  const flags = view.getUint32(20, true)
  const placement = parsePlacementV1(view, 0)
  return {
    revision,
    effectiveMode,
    letterboxActive: (flags & 1) !== 0,
    useIdentityPlacement: (flags & 2) !== 0,
    surfaceFramebuffer: {
      width: view.getFloat32(24, true),
      height: view.getFloat32(28, true),
    },
    logical: {
      width: view.getFloat32(32, true),
      height: view.getFloat32(36, true),
    },
    placement,
    presentationScale: placement.scaleX,
    editorViewOrigin: { x: 0, y: 0 },
    surfacePixelsPerWorldUnit: placement.scaleX,
    visibleWorldBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  }
}

function parsePresentationSnapshotV2(heap: Uint8Array, ptr: number): PresentationSnapshot {
  const view = new DataView(heap.buffer, heap.byteOffset + ptr, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
  const revision = view.getBigUint64(8, true)
  const modeOrdinal = view.getUint32(16, true)
  const effectiveMode = MODE_FROM_ABI[modeOrdinal]
  if (!effectiveMode) {
    throw new Error(`Unsupported presentation mode ABI: ${modeOrdinal}`)
  }
  const flags = view.getUint32(20, true)
  const placement = parsePlacementV1(view, 0)
  return {
    revision,
    effectiveMode,
    letterboxActive: (flags & 1) !== 0,
    useIdentityPlacement: (flags & 2) !== 0,
    surfaceFramebuffer: {
      width: view.getFloat32(24, true),
      height: view.getFloat32(28, true),
    },
    logical: {
      width: view.getFloat32(32, true),
      height: view.getFloat32(36, true),
    },
    placement,
    presentationScale: placement.scaleX,
    editorViewOrigin: {
      x: view.getFloat32(64, true),
      y: view.getFloat32(68, true),
    },
    surfacePixelsPerWorldUnit: view.getFloat32(72, true),
    visibleWorldBounds: {
      minX: view.getFloat32(76, true),
      minY: view.getFloat32(80, true),
      maxX: view.getFloat32(84, true),
      maxY: view.getFloat32(88, true),
    },
  }
}

/**
 * Parses the WASM static buffer returned by `editor_get_presentation_snapshot`.
 * @param heap wasm module HEAPU8
 * @param ptr byte offset of PresentationSnapshotWasm
 */
export function parsePresentationSnapshotWasm(
  heap: Uint8Array,
  ptr: number,
): PresentationSnapshot {
  const header = new DataView(heap.buffer, heap.byteOffset + ptr, 8)
  const abiVersion = header.getUint32(0, true)
  const byteSize = header.getUint32(4, true)
  if (byteSize === 0 && abiVersion > 0 && abiVersion < 1_000_000) {
    return parseLegacyPresentationSnapshotWasm(heap, ptr)
  }
  if (abiVersion === 1 && byteSize === PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE_V1) {
    return parsePresentationSnapshotV1(heap, ptr)
  }
  if (abiVersion === PRESENTATION_SNAPSHOT_ABI_VERSION
    && byteSize === PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE) {
    return parsePresentationSnapshotV2(heap, ptr)
  }
  throw new Error(`Unsupported presentation ABI: version=${abiVersion} size=${byteSize}`)
}
