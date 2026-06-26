import type { Dispatch } from 'react'
import type { Action } from '../store/editor-store'
import {
  editorFrameWorldBounds,
  editorReadEditorView,
  editorSetEditorView,
} from './wasm-bridge'

/** CSS zoom from WASM device-px-per-world zoom. */
export function editorZoomCssFromDevice(zoomDevice: number, devicePixelRatio: number): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  const z = zoomDevice > 0 ? zoomDevice : 1
  return z / dpr
}

/** Pushes committed WASM editor zoom into the React store when it changed. */
export function syncEditorZoomFromWasm(
  dispatch: Dispatch<Action>,
  devicePixelRatio: number,
): void {
  const view = editorReadEditorView()
  const cssZoom = editorZoomCssFromDevice(view.zoomDevice, devicePixelRatio)
  dispatch({ type: 'EDITOR_SET_ZOOM', zoom: cssZoom })
}

/** World point at the centre of a fixed-surface editor viewport. */
export function visibleWorldCenterFromCamera(
  cameraTopLeft: Readonly<{ x: number; y: number }>,
  clientWidth: number,
  clientHeight: number,
  editorZoom: number,
): Readonly<{ x: number; y: number }> {
  const z = editorZoom > 0 ? editorZoom : 1
  return {
    x: cameraTopLeft.x + clientWidth / (2 * z),
    y: cameraTopLeft.y + clientHeight / (2 * z),
  }
}

/** Centres a world point in the fixed viewport via ViewController. */
export function editorCenterWorldPoint(
  world: Readonly<{ x: number; y: number }>,
  clientWidth: number,
  clientHeight: number,
  editorZoom: number,
  devicePixelRatio: number,
): void {
  const z = editorZoom > 0 ? editorZoom : 1
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  editorSetEditorView(
    world.x - clientWidth / (2 * z),
    world.y - clientHeight / (2 * z),
    z * dpr,
  )
}

/** Frames world bounds in the editor viewport (fit / Home). */
export function editorFrameWorld(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  dispatch: Dispatch<Action>,
  devicePixelRatio: number,
): void {
  editorFrameWorldBounds(minX, minY, maxX, maxY)
  syncEditorZoomFromWasm(dispatch, devicePixelRatio)
}
