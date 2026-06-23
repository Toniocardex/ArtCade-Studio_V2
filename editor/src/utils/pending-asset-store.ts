export interface PendingAssetWrite {
  path: string
  bytes: Uint8Array
}

const pendingAssets = new Map<string, Uint8Array>()

export function stagePendingAsset(path: string, bytes: Uint8Array): void {
  pendingAssets.set(path, bytes.slice())
}

export function readPendingAsset(path: string): Uint8Array | null {
  const bytes = pendingAssets.get(path)
  return bytes ? bytes.slice() : null
}

export function discardPendingAsset(path: string): void {
  pendingAssets.delete(path)
}

export function clearPendingAssets(): void {
  pendingAssets.clear()
}

/**
 * Drop every staged asset except the given paths. Used on project load to free
 * bytes for assets the loaded project no longer references, while keeping
 * not-yet-persisted bytes that it still references (otherwise a load between
 * import and save would silently orphan those files — the lost-texture bug).
 */
export function retainPendingAssets(keepPaths: Iterable<string>): void {
  const keep = keepPaths instanceof Set ? keepPaths : new Set(keepPaths)
  for (const path of [...pendingAssets.keys()]) {
    if (!keep.has(path)) pendingAssets.delete(path)
  }
}

export function commitPendingAssets(paths: readonly string[]): void {
  for (const path of paths) pendingAssets.delete(path)
}

export function pendingAssetCount(): number {
  return pendingAssets.size
}

export async function flushPendingAssets(
  write: (entry: PendingAssetWrite) => Promise<void>,
  include: (path: string) => boolean = () => true,
): Promise<string[]> {
  const entries = [...pendingAssets.entries()].map(([path, bytes]) => ({
    path,
    bytes: bytes.slice(),
  }))

  for (const entry of entries) {
    if (include(entry.path)) await write(entry)
  }
  return entries.map((entry) => entry.path)
}
