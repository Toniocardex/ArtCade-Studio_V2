import { useEditor } from '../../store/editor-store'
import { DEFAULT_WORLD } from '../../types'
import { InspectorSection } from './inspector-fields'

export function WorldSettingsSection() {
  const { state, dispatch } = useEditor()
  const w = { ...DEFAULT_WORLD, ...state.project?.world }

  const num = (label: string, key: keyof typeof w, step: number) => (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="text-[9px] text-[var(--muted)] uppercase">{label}</span>
      <input
        type="number"
        step={step}
        value={w[key]}
        onChange={(e) =>
          dispatch({ type: 'WORLD_SET', patch: { [key]: Number(e.target.value) } })
        }
        className="w-20 bg-[var(--border)] border border-[var(--border-2)] text-[var(--accent)]
                   text-[11px] rounded px-2 py-0.5 text-right focus:outline-none
                   focus:border-[var(--accent)]"
      />
    </div>
  )

  return (
    <InspectorSection label="World Settings" defaultOpen>
      {num('Gravity (m/s²)', 'gravity', 0.1)}
      {num('Px / Meter', 'pixelsPerMeter', 1)}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-[var(--muted)] uppercase">Time Scale</span>
          <span className="text-[11px] text-[var(--accent-2)]">{w.timeScale.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={w.timeScale}
          onChange={(e) =>
            dispatch({ type: 'WORLD_SET', patch: { timeScale: Number(e.target.value) } })
          }
          className="w-full accent-[var(--accent-2)]"
        />
      </div>
    </InspectorSection>
  )
}
