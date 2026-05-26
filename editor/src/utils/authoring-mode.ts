import {
  AUTHORING_MODE_STORAGE_KEY,
  DEFAULT_AUTHORING_MODE,
  type AuthoringMode,
} from '../types/authoring-mode'

export function isAuthoringMode(value: unknown): value is AuthoringMode {
  return value === 'base' || value === 'advanced'
}

export function readStoredAuthoringMode(): AuthoringMode {
  try {
    const raw = localStorage.getItem(AUTHORING_MODE_STORAGE_KEY)
    return isAuthoringMode(raw) ? raw : DEFAULT_AUTHORING_MODE
  } catch {
    return DEFAULT_AUTHORING_MODE
  }
}

export function persistAuthoringMode(mode: AuthoringMode): void {
  try {
    localStorage.setItem(AUTHORING_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore quota / private mode */
  }
}

/** Sync `data-authoring-mode` for optional CSS density hooks. */
export function applyAuthoringModeToDocument(mode: AuthoringMode): void {
  document.documentElement.setAttribute('data-authoring-mode', mode)
}
