import { PivotPresetFields } from '../../components/pivot/PivotPresetFields'
import { getAssetDefaultPivot } from '../../utils/sprite-pivot-resolve'
import type { ImageAsset } from '../../types'

type DefaultPivotPanelProps = Readonly<{
  asset: ImageAsset
  onPatchDefaultPivot: (pivot: ImageAsset['defaultPivot']) => void
}>

export function DefaultPivotPanel({ asset, onPatchDefaultPivot }: DefaultPivotPanelProps) {
  const pivot = getAssetDefaultPivot(asset)

  return (
    <div className="pt-2 mt-2 border-t border-[var(--border)]">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
        Default pivot
      </p>
      <p className="text-[9px] text-[var(--muted)] mb-2 leading-snug">
        Entities using this sheet inherit this anchor unless they override it in the Inspector.
      </p>
      <PivotPresetFields
        pivot={pivot}
        compact
        onChange={(next) => onPatchDefaultPivot(next)}
      />
    </div>
  )
}
