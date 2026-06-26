import { describe, expect, it } from 'vitest'
import {
  PRESENTATION_SNAPSHOT_ABI_VERSION,
  PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE,
  PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE_V1,
  parsePresentationSnapshotWasm,
} from './presentation-snapshot'

function writeSnapshotV2(
  heap: Uint8Array,
  ptr: number,
  fields: Partial<{
    revision: bigint
    mode: number
    flags: number
    editorViewOriginX: number
    editorViewOriginY: number
    surfacePixelsPerWorldUnit: number
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
  view.setFloat32(64, fields.editorViewOriginX ?? 100, true)
  view.setFloat32(68, fields.editorViewOriginY ?? 50, true)
  view.setFloat32(72, fields.surfacePixelsPerWorldUnit ?? 2, true)
  view.setFloat32(76, 0, true)
  view.setFloat32(80, 0, true)
  view.setFloat32(84, 640, true)
  view.setFloat32(88, 360, true)
}

describe('presentation-snapshot', () => {
  it('parses the 96-byte WASM ABI v2', () => {
    const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
    writeSnapshotV2(heap, 0, { revision: 42n, mode: 2, flags: 1 })
    const snap = parsePresentationSnapshotWasm(heap, 0)
    expect(snap.revision).toBe(42n)
    expect(snap.effectiveMode).toBe('playEmbedded')
    expect(snap.letterboxActive).toBe(true)
    expect(snap.logical).toEqual({ width: 320, height: 240 })
    expect(snap.editorViewOrigin).toEqual({ x: 100, y: 50 })
    expect(snap.surfacePixelsPerWorldUnit).toBe(2)
    expect(snap.visibleWorldBounds).toEqual({ minX: 0, minY: 0, maxX: 640, maxY: 360 })
  })

  it('parses the legacy 64-byte WASM ABI v1', () => {
    const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE_V1)
    const view = new DataView(heap.buffer)
    view.setUint32(0, 1, true)
    view.setUint32(4, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE_V1, true)
    view.setBigUint64(8, 42n, true)
    view.setUint32(16, 2, true)
    view.setUint32(20, 1, true)
    view.setFloat32(32, 320, true)
    view.setFloat32(36, 240, true)
    view.setFloat32(56, 2, true)
    view.setFloat32(60, 2, true)

    const snap = parsePresentationSnapshotWasm(heap, 0)
    expect(snap.revision).toBe(42n)
    expect(snap.editorViewOrigin).toEqual({ x: 0, y: 0 })
  })

  it('rejects unsupported ABI versions', () => {
    const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
    writeSnapshotV2(heap, 0, { revision: 42n, mode: 2, flags: 1 })
    new DataView(heap.buffer).setUint32(0, 999, true)

    expect(() => parsePresentationSnapshotWasm(heap, 0))
      .toThrow('Unsupported presentation ABI: version=999 size=96')
  })

  it('rejects unsupported mode ordinals', () => {
    const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
    writeSnapshotV2(heap, 0, { revision: 42n, mode: 99, flags: 1 })

    expect(() => parsePresentationSnapshotWasm(heap, 0))
      .toThrow('Unsupported presentation mode ABI: 99')
  })

  it('parses pre-v1 WASM layout when byteSize is zero', () => {
    const heap = new Uint8Array(64)
    const view = new DataView(heap.buffer)
    view.setBigUint64(0, 9n, true)
    view.setUint32(8, 0, true)
    view.setUint32(12, 0, true)
    view.setFloat32(16, 800, true)
    view.setFloat32(20, 600, true)
    view.setFloat32(24, 320, true)
    view.setFloat32(28, 180, true)
    view.setFloat32(56, 1.5, true)

    const snap = parsePresentationSnapshotWasm(heap, 0)
    expect(snap.revision).toBe(9n)
    expect(snap.effectiveMode).toBe('sceneEdit')
    expect(snap.surfaceFramebuffer).toEqual({ width: 800, height: 600 })
    expect(snap.presentationScale).toBe(1.5)
  })
})
