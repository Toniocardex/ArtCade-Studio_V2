import { useEditor } from '../../store/editor-store'
import { DEFAULT_WORLD } from '../../types'
import { InspectorSection } from './inspector-fields'

const physicsModeSelectId = 'world-physics-mode'

export function WorldSettingsSection() {
  const { state, dispatch } = useEditor()
  const w = { ...DEFAULT_WORLD, ...state.project?.world }

  const num = (label: string, key: 'gravity' | 'pixelsPerMeter', step: number) => (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="text-[9px] text-[var(--muted)] uppercase">{label}</span>
      <input
        type="number"
        step={step}
        value={w[key]}
        onChange={(e) =>
          dispatch({ type: 'WORLD_SET', patch: { [key]: Number(e.target.value) } })
        }
        className="w-20 bg-[var(--panel-3)] border border-[var(--border-2)] text-[var(--text)]
                   text-[11px] rounded px-2 py-0.5 text-right focus:outline-none
                   focus:border-[var(--accent-2)] transition-colors"
      />
    </div>
  )

  return (
    <InspectorSection label="World Settings" defaultOpen>
      {num('Gravity (m/s²)', 'gravity', 0.1)}
      {num('Px / Meter', 'pixelsPerMeter', 1)}
      <div className="mb-2">
        <label
          htmlFor={physicsModeSelectId}
          className="text-[9px] text-[var(--muted)] uppercase block mb-1"
        >
          Physics simulation
        </label>
        <select
          id={physicsModeSelectId}
          value={w.physicsMode ?? 'auto'}
          onChange={(e) =>
            dispatch({
              type: 'WORLD_SET',
              patch: { physicsMode: e.target.value as 'off' | 'auto' | 'on' },
            })
          }
          className="w-full bg-[var(--panel-3)] border border-[var(--border-2)] text-[var(--text)]
                     text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[var(--accent-2)]"
        >
          <option value="auto">Auto (only when bodies exist)</option>
          <option value="on">On (always step)</option>
          <option value="off">Off (no physics step)</option>
        </select>
        <p className="text-[9px] text-[var(--muted)] mt-1 leading-snug">
          Auto skips physics for pure transform / platformer-only scenes. Sensors need On or bodies in Auto.
        </p>
      </div>
      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={w.logicDebugTrace === true}
          onChange={(e) =>
            dispatch({ type: 'WORLD_SET', patch: { logicDebugTrace: e.target.checked } })
          }
          className="accent-[var(--accent-2)]"
        />
        <span className="text-[10px] text-[var(--text)]">Logic Board debug trace (console)</span>
      </label>
      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={w.physicsDebugDraw === true}
          onChange={(e) =>
            dispatch({ type: 'WORLD_SET', patch: { physicsDebugDraw: e.target.checked } })
          }
          className="accent-[var(--accent-2)]"
        />
        <span className="text-[10px] text-[var(--text)]">Physics collider overlay (play)</span>
      </label>
      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={w.showRuntimeStats === true}
          onChange={(e) =>
            dispatch({ type: 'WORLD_SET', patch: { showRuntimeStats: e.target.checked } })
          }
          className="accent-[var(--accent-2)]"
        />
        <span className="text-[10px] text-[var(--text)]">Runtime stats in status bar (play)</span>
      </label>
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
