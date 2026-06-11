export type LayerSettingsSectionProps = Readonly<{
  layerName: string
  sceneName: string | undefined
}>

export function LayerSettingsSection({ layerName, sceneName }: LayerSettingsSectionProps) {
  return (
    <div className="space-y-3 text-[10px] text-[var(--primary-soft)]">
      <p>
        Layer <strong className="text-[var(--primary)]">{layerName}</strong>
        {sceneName ? (
          <> in <strong className="text-[var(--primary)]">{sceneName}</strong></>
        ) : null}
      </p>
      <p className="text-[var(--muted)] leading-relaxed">
        Rename or reorder layers in the Layers panel (left sidebar).
        Assign entities to a layer via the Layer field in the Inspector.
      </p>
    </div>
  )
}
