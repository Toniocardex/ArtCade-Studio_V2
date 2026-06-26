/**
 * TypeScript mirror of {@link PresentationSnapshotWasm} (64-byte flat ABI).
 * React overlays read this store — no independent fit/letterbox math (ADR Phase 5).
 */

export const PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE = 64

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
  const revision = view.getBigUint64(0, true)
  const effectiveMode = MODE_FROM_ABI[view.getUint32(8, true)] ?? 'sceneEdit'
  const flags = view.getUint32(12, true)
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
      scaleX: view.getFloat32(48, true),
      scaleY: view.getFloat32(52, true),
    },
    presentationScale: view.getFloat32(56, true),
  }
}
