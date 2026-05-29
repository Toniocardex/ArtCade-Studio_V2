import { editorPreviewSpritesheetReset, editorPreviewSpritesheetSubmit } from './wasm-bridge'

export type SpritesheetPreviewFrameHandler = (
  status: number,
  width: number,
  height: number,
  rgba: Uint8ClampedArray | null,
) => void

function emscriptenGlobal(): Window {
  return globalThis as unknown as Window
}

declare global {
  interface Window {
    onSpritesheetPreviewFrame?: (
      status: number,
      width: number,
      height: number,
      rgba: Uint8ClampedArray | 0,
    ) => void
  }
}

let frameHandler: SpritesheetPreviewFrameHandler | null = null

/** Install the C++ → JS spritesheet preview callback (call once at app/editor boot). */
export function installSpritesheetPreviewCallback(): void {
  emscriptenGlobal().onSpritesheetPreviewFrame = (status, width, height, rgba) => {
    frameHandler?.(status, width, height, rgba === 0 ? null : rgba)
  }
}

export function setSpritesheetPreviewFrameHandler(handler: SpritesheetPreviewFrameHandler | null): void {
  frameHandler = handler
}

export function submitSpritesheetPreviewFrame(
  texturePath: string,
  clipName: string,
  dtSeconds: number,
  width: number,
  height: number,
): number {
  return editorPreviewSpritesheetSubmit(texturePath, clipName, dtSeconds, width, height)
}

export { editorPreviewSpritesheetReset }
