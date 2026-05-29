import { isTauri } from '@tauri-apps/api/core'
import { watch, type UnwatchFn } from '@tauri-apps/plugin-fs'
import { joinPath } from './file-paths'

export type AssetChangedHandler = (relPath: string) => void

const DEBOUNCE_MS = 200

/** Watch `assets/**` under project root; invokes handler with project-relative paths. */
export async function watchProjectAssets(
  projectRoot: string,
  onChanged: AssetChangedHandler,
): Promise<UnwatchFn | null> {
  if (!isTauri()) return null
  const assetsDir = joinPath(projectRoot, 'assets')
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  const schedule = (absPath: string) => {
    const normalized = absPath.replace(/\\/g, '/')
    const root = projectRoot.replace(/\\/g, '/').replace(/\/$/, '')
    if (!normalized.startsWith(root + '/')) return
    const rel = normalized.slice(root.length + 1)
    if (!rel.startsWith('assets/')) return
    const prev = pending.get(rel)
    if (prev) clearTimeout(prev)
    pending.set(
      rel,
      setTimeout(() => {
        pending.delete(rel)
        onChanged(rel)
      }, DEBOUNCE_MS),
    )
  }

  try {
    return await watch(
      assetsDir,
      (event) => {
        for (const p of event.paths) schedule(p)
      },
      { recursive: true },
    )
  } catch (err) {
    console.warn('[asset-watcher] watch failed:', err)
    return null
  }
}
