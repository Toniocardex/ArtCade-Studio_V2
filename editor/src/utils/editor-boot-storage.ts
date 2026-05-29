/** localStorage: marketing splash shown once per machine (see EditorBootGate). */
export const BOOT_SPLASH_SEEN_KEY = 'artcade.editor.boot.splash-seen'

export function hasSeenBootSplash(): boolean {
  if (globalThis.window === undefined) return true
  try {
    return globalThis.localStorage.getItem(BOOT_SPLASH_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markBootSplashSeen(): void {
  if (globalThis.window === undefined) return
  try {
    globalThis.localStorage.setItem(BOOT_SPLASH_SEEN_KEY, '1')
  } catch {
    /* private mode / quota */
  }
}
