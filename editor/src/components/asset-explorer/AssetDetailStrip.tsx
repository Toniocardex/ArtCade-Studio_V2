import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import type { ImageAsset, AnimationClipDef } from '../../types'
import { AnimationClipsEditor } from '../AnimationClipsEditor'
import { ImagePointsEditor } from './ImagePointsEditor'
import type { AssetExplorerSelection } from '../../hooks/useAssetExplorerActions'

export type AssetDetailStripProps = Readonly<{
  selection: AssetExplorerSelection
}>

export function AssetDetailStrip({ selection }: AssetDetailStripProps) {
  const { state, dispatch } = useEditor()
  const [open, setOpen] = useState(true)
  const project = state.project

  if (selection.type !== 'image' || !project) return null
  const asset: ImageAsset | undefined = project.assets?.[selection.id]
  if (!asset) return null

  function patchImage(patch: Partial<ImageAsset>) {
    dispatch({ type: 'ASSET_ADD', asset: { ...asset!, ...patch } })
  }

  return (
    <div className="mx-2 mb-2 rounded border border-[var(--border)] bg-[var(--panel-2)] flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-2 py-1.5 text-left border-b border-[var(--border)]
                   hover:bg-[rgb(var(--border-rgb)/0.2)]"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown size={12} className="text-[var(--muted)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--muted)]" />
        )}
        <span className="text-[10px] font-semibold text-[var(--text)] truncate">
          Image details — {asset.name}
        </span>
      </button>
      {open ? (
        <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
          <ImagePointsEditor
            asset={asset}
            onPatchPoints={(points) => patchImage({ imagePoints: points })}
          />
          <AnimationClipsEditor
            asset={asset}
            onPatch={(clips: AnimationClipDef[]) => patchImage({ clips })}
          />
        </div>
      ) : null}
    </div>
  )
}
