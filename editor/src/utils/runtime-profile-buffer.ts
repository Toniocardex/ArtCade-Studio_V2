// ---------------------------------------------------------------------------
// Last WASM runtime profile sample (pushed from C++ via onRuntimeProfile).
// ---------------------------------------------------------------------------

export interface RuntimeProfileSample {
  fps: number
  luaMs: number
  physicsMs: number
  renderMs: number
  entityCount: number
  physicsBodies: number
}

const EMPTY: RuntimeProfileSample = {
  fps: 0,
  luaMs: 0,
  physicsMs: 0,
  renderMs: 0,
  entityCount: 0,
  physicsBodies: 0,
}

let lastSample: RuntimeProfileSample = EMPTY

export function setRuntimeProfileSample(sample: RuntimeProfileSample): void {
  lastSample = sample
}

export function getRuntimeProfileSample(): RuntimeProfileSample {
  return lastSample
}

export function clearRuntimeProfileSample(): void {
  lastSample = EMPTY
}
