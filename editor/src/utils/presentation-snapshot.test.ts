import { describe, expect, it } from 'vitest'
import {
  PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE,
  parsePresentationSnapshotWasm,
  type PresentationSnapshot,
} from './presentation-snapshot'

function writeSnapshot(
  heap: Uint8Array,
  ptr: number,
  fields: Partial<{
    revision: bigint
    mode: number
    flags: number
    presentationScale: number
  }>,
): void {
  const view = new DataView(heap.buffer, heap.byteOffset + ptr, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
  view.setBigUint64(0, fields.revision ?? 1n, true)
  view.setUint32(8, fields.mode ?? 2, true)
  view.setUint32(12, fields.flags ?? 0, true)
  view.setFloat32(24, 320, true)
  view.setFloat32(28, 240, true)
  view.setFloat32(48, 2, true)
  view.setFloat32(52, 2, true)
  view.setFloat32(56, fields.presentationScale ?? 2, true)
}

describe('presentation-snapshot', () => {
  it('parses the 64-byte WASM ABI', () => {
    const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
    writeSnapshot(heap, 0, { revision: 42n, mode: 2, flags: 1 })
    const snap = parsePresentationSnapshotWasm(heap, 0)
    expect(snap.revision).toBe(42n)
    expect(snap.effectiveMode).toBe('playEmbedded')
    expect(snap.letterboxActive).toBe(true)
    expect(snap.logical).toEqual({ width: 320, height: 240 })
    expect(snap.placement.scaleX).toBe(2)
  })
})
