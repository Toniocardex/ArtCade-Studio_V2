export type LayerSettingsSectionProps = Readonly<{
  layerName: string
  sceneName: string | undefined
}>

/** Placeholder until ProjectDoc gains a persisted layer model. */
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
        Layer ordering and per-layer filters are UI-only for now. A persisted layer model
        will land in a future format revision; assign entities via render order until then.
      </p>
    </div>
  )
}
