/** Vite `base`-aware URL for files copied from `public/runtime/` → `dist/runtime/`. */
export function runtimeAssetPath(file: string): string {
  const base = import.meta.env.BASE_URL
  const root = base.endsWith('/') ? base : `${base}/`
  const name = file.startsWith('/') ? file.slice(1) : file
  return `${root}runtime/${name}`
}

export const WASM_RUNTIME_SRC = runtimeAssetPath('game.js')
export const WASM_BINARY_URL = runtimeAssetPath('game.wasm')
