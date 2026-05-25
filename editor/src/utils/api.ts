// ---------------------------------------------------------------------------
// api.ts - compatibility facade for Tauri IPC/file helpers.
//
// Keep importing from `utils/api` in UI code; implementation lives in focused
// modules grouped by responsibility.
// ---------------------------------------------------------------------------

export * from './asset-file-api'
export * from './build-api'
export * from './project-file-api'
