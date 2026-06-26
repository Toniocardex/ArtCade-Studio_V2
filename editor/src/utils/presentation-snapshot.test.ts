import { describe, expect, it } from 'vitest'
import {
  PRESENTATION_SNAPSHOT_ABI_VERSION,
  PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE,
  parsePresentationSnapshotWasm,
} from './presentation-snapshot'

function writeSnapshot(
  heap: Uint8Array,
  ptr: number,
  fields: Partial<{
    revision: bigint
    mode: number
    flags: number
  }>,
): void {
  const view = new DataView(heap.buffer, heap.byteOffset + ptr, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
  view.setUint32(0, PRESENTATION_SNAPSHOT_ABI_VERSION, true)
  view.setUint32(4, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE, true)
  view.setBigUint64(8, fields.revision ?? 1n, true)
  view.setUint32(16, fields.mode ?? 2, true)
  view.setUint32(20, fields.flags ?? 0, true)
  view.setFloat32(32, 320, true)
  view.setFloat32(36, 240, true)
  view.setFloat32(56, 2, true)
  view.setFloat32(60, 2, true)
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

  it('rejects unsupported ABI versions', () => {
    const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
    writeSnapshot(heap, 0, { revision: 42n, mode: 2, flags: 1 })
    new DataView(heap.buffer).setUint32(0, 999, true)

    expect(() => parsePresentationSnapshotWasm(heap, 0))
      .toThrow('Unsupported presentation ABI: 999')
  })

  it('rejects unsupported mode ordinals', () => {
    const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
    writeSnapshot(heap, 0, { revision: 42n, mode: 99, flags: 1 })

    expect(() => parsePresentationSnapshotWasm(heap, 0))
      .toThrow('Unsupported presentation mode ABI: 99')
  })
})
