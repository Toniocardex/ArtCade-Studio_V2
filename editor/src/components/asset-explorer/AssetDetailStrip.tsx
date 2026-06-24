import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import {
  IMAGE_ASSET_USAGE_LABELS,
  IMAGE_ASSET_USAGES,
  type ImageAsset,
  type ImageAssetUsage,
} from '../../types'
import { AnimationClipsSummary } from './AnimationClipsSummary'
import { ImageAssetPreview } from './ImageAssetPreview'
import { openSpritesheetStudio } from '../../panels/spritesheet-studio/openSpritesheetStudio'
import { ImagePointsEditor } from './ImagePointsEditor'
import type { AssetExplorerSelection } from '../../hooks/useAssetExplorerActions'
import { EditorSelect } from '../ui/EditorSelect'
import { Field } from '../../panels/inspector/inspector-fields'

export type AssetDetailStripProps = Readonly<{
  selection: AssetExplorerSelection
}>

export function AssetDetailStrip({ selection }: AssetDetailStripProps) {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const [open, setOpen] = useState(true)

  if (selection.type !== 'image' || !project) return null
  const asset: ImageAsset | undefined = project.assets?.[selection.id]
  if (!asset) return null

  const openStudio = () => openSpritesheetStudio(dispatch, project, selection.id)

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
        <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
          <Field
            label="Display Name"
            value={asset.name}
            onCommit={(name) =>
              dispatch({ type: 'IMAGE_ASSET_RENAME', assetId: asset.id, name })
            }
          />
          <ImageAssetPreview
            asset={asset}
            projectPath={projectPath}
            onOpenStudio={openStudio}
          />
          <div>
            <label htmlFor={`image-usage-${asset.id}`} className="text-[9px] text-[var(--muted)] uppercase">
              Usage
            </label>
            <EditorSelect
              id={`image-usage-${asset.id}`}
              value={asset.usage}
              onChange={(usage) => patchImage({ usage: usage as ImageAssetUsage })}
              triggerClassName="py-1"
              options={IMAGE_ASSET_USAGES.map((usage) => ({
                value: usage,
                label: IMAGE_ASSET_USAGE_LABELS[usage],
              }))}
            />
          </div>
          {asset.usage === 'sprite' ? (
            <>
              <ImagePointsEditor
                asset={asset}
                onPatchPoints={(points) => patchImage({ imagePoints: points })}
              />
              <AnimationClipsSummary asset={asset} onOpenStudio={openStudio} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
