import { isTauri } from '@tauri-apps/api/core'
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile, mkdir } from '@tauri-apps/plugin-fs'
import { joinPath } from './file-paths'

function notAvailable(name: string): void {
  console.warn(`[api] ${name}: Tauri not available in browser mode`)
}

/** Native file-picker for a spritesheet image. Returns the path or null. */
export async function openImageDialog(): Promise<string | null> {
  if (!isTauri()) { notAvailable('openImageDialog'); return null }

  const selected = await dialogOpen({
    title:    'Open Tileset Image',
    multiple: false,
    filters:  [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
  })
  return typeof selected === 'string' ? selected : null
}

/** Read an image from disk and return a base64 data URL for React preview. */
export async function readImageAsDataUrl(path: string): Promise<string | null> {
  if (!isTauri()) { notAvailable('readImageAsDataUrl'); return null }

  try {
    const bytes = await readFile(path)
    const ext = path.toLowerCase().split('.').pop() ?? 'png'
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : 'image/png'
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return `data:${mime};base64,${btoa(bin)}`
  } catch (err) {
    console.error('[api] readImageAsDataUrl failed:', err)
    return null
  }
}

/**
 * Copy an imported image into the project's `assets/images/` folder so it
 * survives reopen / .artcade. Returns the path relative to the project root.
 */
export async function importImageIntoProject(
  projectRoot: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<string | null> {
  if (!isTauri()) { notAvailable('importImageIntoProject'); return null }
  const relDir  = 'assets/images'
  const relPath = `${relDir}/${fileName}`
  try {
    await mkdir(joinPath(projectRoot, relDir), { recursive: true })
    await writeFile(joinPath(projectRoot, relPath), bytes)
    return relPath
  } catch (err) {
    console.error('[api] importImageIntoProject failed:', err)
    return null
  }
}

/** Read a project image (path relative to project root) as raw bytes. */
export async function readProjectImageBytes(
  projectRoot: string,
  relPath: string,
): Promise<Uint8Array | null> {
  if (!isTauri()) { notAvailable('readProjectImageBytes'); return null }
  try {
    return await readFile(joinPath(projectRoot, relPath))
  } catch (err) {
    console.error('[api] readProjectImageBytes failed:', err)
    return null
  }
}
