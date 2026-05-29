import { useEffect } from 'react'
import type { ImageAsset } from '../../types'
import { useEditor } from '../../store/editor-store'
import { syncAnimationClipsToWasm } from '../../utils/sync-animation-clips-wasm'
import { editorPreviewSpritesheetReset } from '../../utils/wasm-bridge'

/** Keep WASM SpriteAnimator clips aligned with live ASSET_ADD edits in the studio. */
export function useSpritesheetWasmSync(asset: ImageAsset, enabled: boolean): void {
  const { state } = useEditor()

  useEffect(() => {
    if (!enabled || !state.project) return
    syncAnimationClipsToWasm(state.project)
    return () => {
      editorPreviewSpritesheetReset()
    }
  }, [enabled, state.project, asset.clips, asset.id, asset.path])
}
