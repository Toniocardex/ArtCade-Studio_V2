// ---------------------------------------------------------------------------
// asset-types — orchestration contracts (ASSET_PIPELINE_ARCHITECTURE §5.2, §7.1)
// ---------------------------------------------------------------------------

export type AssetKind = 'image' | 'audio' | 'font'

export interface AssetDescriptor {
  id: string
  type: AssetKind
  /** Project-relative path, e.g. assets/images/hero.png */
  path: string
  ext?: string
  /** Transient in-memory bytes (unsaved import); not on disk. */
  dataUrl?: string
}

export interface AssetLoadFailure {
  path: string
  reason: string
}

export interface AssetLoadResult {
  ok: boolean
  loaded: string[]
  failed: AssetLoadFailure[]
  cancelled?: boolean
}

export type AssetLoadPriority = 'critical' | 'prefetch'

export interface AssetLoadRequest {
  descriptor: AssetDescriptor
  priority: AssetLoadPriority
  generation: number
}
