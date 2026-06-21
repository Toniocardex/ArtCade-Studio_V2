import type { AnimationClipDef, ImageAsset } from '../types'

export type ClipDraftValidation = Readonly<{
  canSave: boolean
  message: string | null
}>

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export function normalizeClipDraftName(name: string): string {
  const base = stripExtension(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  return base || 'clip'
}

export function nextClipDraftName(asset: ImageAsset, clips: readonly AnimationClipDef[]): string {
  const base = normalizeClipDraftName(asset.name || asset.path || asset.id)
  const used = new Set(clips.map((clip) => clip.name.trim()).filter(Boolean))
  if (!used.has(base)) return base
  for (let n = 2; n < 10000; n += 1) {
    const candidate = `${base}_${n}`
    if (!used.has(candidate)) return candidate
  }
  return `${base}_${Date.now()}`
}

export function validateClipDraft(
  draft: AnimationClipDef | undefined,
  clips: readonly AnimationClipDef[],
  duplicateAcrossAssets: string | null,
): ClipDraftValidation {
  if (!draft || draft.frames.length === 0) {
    return { canSave: false, message: 'Select at least one frame.' }
  }
  const name = draft.name.trim()
  if (!name) return { canSave: false, message: 'Name the animation.' }
  if (clips.some((clip) => clip.name.trim() === name)) {
    return { canSave: false, message: `Clip name "${name}" already exists on this sheet.` }
  }
  if (duplicateAcrossAssets) {
    return {
      canSave: false,
      message: `Clip name "${name}" is already used on "${duplicateAcrossAssets}".`,
    }
  }
  return { canSave: true, message: null }
}
