import { useEffect } from 'react'
import type { ImageAsset } from '../../types'
import { useEditor } from '../../store/editor-store'
import { assetOrchestrator } from '../../utils/asset-orchestrator'
import { dirName } from '../../utils/project'
import { syncAnimationClipsToWasm } from '../../utils/sync-animation-clips-wasm'
import { editorPreviewSpritesheetReset } from '../../utils/wasm-bridge'

/** Keep WASM texture + SpriteAnimator clips aligned with live studio edits. */
export function useSpritesheetWasmSync(asset: ImageAsset, enabled: boolean): void {
  const { state } = useEditor()
  const project = state.project
  const projectPath = state.projectPath
  const clipsKey = JSON.stringify(asset.clips ?? [])

  useEffect(() => {
    if (!enabled || !project) return
    let cancelled = false
    const root = projectPath ? dirName(projectPath) : ''

    void (async () => {
      await assetOrchestrator.ensureImageRegistered(project, asset, root)
      if (!cancelled) syncAnimationClipsToWasm(project)
    })()

    return () => {
      cancelled = true
      editorPreviewSpritesheetReset()
    }
  }, [enabled, project, projectPath, asset.id, asset.path, asset.dataUrl, clipsKey])
}
