import { describe, expect, it } from 'vitest'
import { editorViewFromSnapshot } from './editor-camera-from-snapshot'
import {
  PRESENTATION_SNAPSHOT_ABI_VERSION,
  PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE,
  parsePresentationSnapshotWasm,
} from './presentation-snapshot'
import { buildEditorRulerMetrics } from './editor-ruler-metrics'

function parseSceneEdit(fields: Parameters<typeof writeSceneEditSnapshot>[2] = {}) {
  const heap = new Uint8Array(PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
  writeSceneEditSnapshot(heap, 0, fields)
  return parsePresentationSnapshotWasm(heap, 0)
}

function writeSceneEditSnapshot(
  heap: Uint8Array,
  ptr: number,
  fields: Partial<{
    revision: bigint
    editorViewOriginX: number
    editorViewOriginY: number
    surfacePixelsPerWorldUnit: number
  }>,
): void {
  const view = new DataView(heap.buffer, heap.byteOffset + ptr, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE)
  view.setUint32(0, PRESENTATION_SNAPSHOT_ABI_VERSION, true)
  view.setUint32(4, PRESENTATION_SNAPSHOT_WASM_BYTE_SIZE, true)
  view.setBigUint64(8, fields.revision ?? 1n, true)
  view.setUint32(16, 0, true) // SceneEdit
  view.setUint32(20, 0, true)
  view.setFloat32(32, 800, true)
  view.setFloat32(36, 600, true)
  view.setFloat32(64, fields.editorViewOriginX ?? 100, true)
  view.setFloat32(68, fields.editorViewOriginY ?? 50, true)
  view.setFloat32(72, fields.surfacePixelsPerWorldUnit ?? 2, true)
  view.setFloat32(76, 0, true)
  view.setFloat32(80, 0, true)
  view.setFloat32(84, 400, true)
  view.setFloat32(88, 300, true)
}

describe('presentation golden (TS mirror)', () => {
  it('maps editor camera from snapshot without scroll vocabulary', () => {
    const snap = parseSceneEdit({
      editorViewOriginX: 42,
      editorViewOriginY: 17,
      surfacePixelsPerWorldUnit: 1.25,
    })
    const camera = editorViewFromSnapshot(snap, 1)
    expect(camera).toEqual({ x: 42, y: 17, zoomDevice: 1.25 })
  })

  it('keeps rulers and camera overlay on the same snapshot revision', () => {
    const snap = parseSceneEdit({ revision: 55n, surfacePixelsPerWorldUnit: 2 })
    const camera = editorViewFromSnapshot(snap, 1)
    const metrics = buildEditorRulerMetrics({
      presentationSnapshot: snap,
      fallbackZoom: 1,
      rulerStep: 64,
      worldSize: { x: 1280, y: 640 },
    })
    expect(snap.revision).toBe(55n)
    expect(metrics.zoom).toBe(camera.zoomDevice)
    expect(metrics.worldMaxX).toBe(snap.visibleWorldBounds.maxX)
  })

  it('selection revision change does not alter camera mapping (camera is snapshot-owned)', () => {
    const cameraA = editorViewFromSnapshot(parseSceneEdit({
      revision: 1n,
      editorViewOriginX: 10,
      editorViewOriginY: 20,
    }), 1)
    const cameraB = editorViewFromSnapshot(parseSceneEdit({
      revision: 2n,
      editorViewOriginX: 10,
      editorViewOriginY: 20,
    }), 1)
    expect(cameraA).toEqual(cameraB)
  })

  it('frame selection updates camera when snapshot origin changes', () => {
    const before = editorViewFromSnapshot(parseSceneEdit({
      editorViewOriginX: 0,
      editorViewOriginY: 0,
    }), 1)
    const after = editorViewFromSnapshot(parseSceneEdit({
      editorViewOriginX: 200,
      editorViewOriginY: 100,
    }), 1)
    expect(before).not.toEqual(after)
  })
})
