/**
 * TypeScript mirror of {@link PresentationSnapshotWasm} (64-byte flat ABI).
 * React overlays read this store — no independent fit/letterbox math (ADR Phase 5).
 */

export const PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE = 64
export const PRESENTATION_SNAPSHOT_ABI_VERSION = 1

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
}>

export type PresentationChangedEvent = Readonly<{
  revision: bigint
  snapshot: PresentationSnapshot
}>

/**
 * Parses the WASM static buffer returned by `editor_get_presentation_snapshot`.
 * @param heap wasm module HEAPU8
 * @param ptr byte offset of PresentationSnapshotWasm
 */
export function parsePresentationSnapshotWasm(
  heap: Uint8Array,
  ptr: number,
): PresentationSnapshot {
  const view = new DataView(heap.buffer, heap.byteOffset + ptr, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
  const abiVersion = view.getUint32(0, true)
  const byteSize = view.getUint32(4, true)
  if (abiVersion !== PRESENTATION_SNAPSHOT_ABI_VERSION) {
    throw new Error(`Unsupported presentation ABI: ${abiVersion}`)
  }
  if (byteSize !== PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE) {
    throw new Error(`Unexpected presentation snapshot size: ${byteSize}`)
  }
  const revision = view.getBigUint64(8, true)
  const modeOrdinal = view.getUint32(16, true)
  const effectiveMode = MODE_FROM_ABI[modeOrdinal]
  if (!effectiveMode) {
    throw new Error(`Unsupported presentation mode ABI: ${modeOrdinal}`)
  }
  const flags = view.getUint32(20, true)
  const scaleX = view.getFloat32(56, true)
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
    placement: {
      destX: view.getFloat32(40, true),
      destY: view.getFloat32(44, true),
      destW: view.getFloat32(48, true),
      destH: view.getFloat32(52, true),
      scaleX,
      scaleY: view.getFloat32(60, true),
    },
    presentationScale: scaleX,
  }
}
