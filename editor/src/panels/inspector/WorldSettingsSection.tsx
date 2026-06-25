import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { DEFAULT_WORLD, type OutputPolicy, type PhysicsMode } from '../../types'
import { InspectorRow, InspectorSection } from './inspector-fields'
import { SegmentedControl } from '../../components/ui/SegmentedControl'

const PHYSICS_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
] as const

const PHYSICS_HINT: Record<PhysicsMode, string> = {
  off: 'No physics step. Pure transform / platformer logic only.',
  auto: 'Skips physics unless at least one body exists.',
  on: 'Always steps the solver. Needed for sensors with no bodies.',
}

const OUTPUT_POLICY_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: 'fill', label: 'Fill' },
  { value: 'stretch', label: 'Stretch' },
] as const

const OUTPUT_POLICY_HINT: Record<OutputPolicy, string> = {
  fit: 'Uniform scale with letterbox or pillarbox bands. Preserves aspect (recommended for pixel art).',
  fill: 'Uniform scale that fills the window. Crops scene edges; no bars.',
  stretch: 'Fills the window. May distort aspect ratio.',
}

export function WorldSettingsSection() {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const w = { ...DEFAULT_WORLD, ...project?.world }
  const physicsMode: PhysicsMode = w.physicsMode ?? 'auto'
  const outputPolicy: OutputPolicy = w.outputPolicy ?? 'fit'

  const num = (
    label: string,
    key: 'gravity' | 'pixelsPerMeter',
    step: number,
    unit: string,
  ) => (
    <InspectorRow label={label} unit={unit}>
      <input
        type="number"
        step={step}
        value={w[key]}
        onChange={(e) =>
          dispatch({ type: 'WORLD_SET', patch: { [key]: Number(e.target.value) } })
        }
        className="editor-input w-16 text-right"
        data-mono
      />
    </InspectorRow>
  )

  return (
    <InspectorSection label="World Settings" defaultOpen>
      {num('Gravity', 'gravity', 0.1, 'm/s²')}
      {num('Px / Meter', 'pixelsPerMeter', 1, 'px/m')}
      <div className="mb-2">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-1">
          Physics simulation
        </span>
        <SegmentedControl
          aria-label="Physics simulation mode"
          value={physicsMode}
          onChange={(mode) =>
            dispatch({
              type: 'WORLD_SET',
              patch: { physicsMode: mode as PhysicsMode },
            })
          }
          options={PHYSICS_OPTIONS}
        />
        <p className="text-[9px] text-[var(--muted)] leading-snug mt-1">
          {PHYSICS_HINT[physicsMode]}
        </p>
      </div>
      <div className="mb-2">
        <span className="text-[9px] text-[var(--muted)] uppercase block mb-1">
          Output policy
        </span>
        <SegmentedControl
          aria-label="Output policy"
          value={outputPolicy}
          onChange={(policy) =>
            dispatch({
              type: 'WORLD_SET',
              patch: { outputPolicy: policy as OutputPolicy },
            })
          }
          options={OUTPUT_POLICY_OPTIONS}
        />
        <p className="text-[9px] text-[var(--muted)] leading-snug mt-1">
          {OUTPUT_POLICY_HINT[outputPolicy]}
        </p>
      </div>
    </InspectorSection>
  )
}

/** Debug toggles + time scale — separate collapsed accordion so the everyday
 *  world parameters above stay scannable (UI charter: no endless scrolling). */
export function WorldDebugTimeSection() {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const w = { ...DEFAULT_WORLD, ...project?.world }

  return (
    <InspectorSection label="Debug & Time">
      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={w.logicDebugTrace === true}
          onChange={(e) =>
            dispatch({ type: 'WORLD_SET', patch: { logicDebugTrace: e.target.checked } })
          }
          className="accent-[var(--accent)]"
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
          className="accent-[var(--accent)]"
        />
        <span className="text-[10px] text-[var(--text)]">Collision overlay (play)</span>
      </label>
      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={w.showRuntimeStats === true}
          onChange={(e) =>
            dispatch({ type: 'WORLD_SET', patch: { showRuntimeStats: e.target.checked } })
          }
          className="accent-[var(--accent)]"
        />
        <span className="text-[10px] text-[var(--text)]">Runtime stats in status bar (play)</span>
      </label>
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-[var(--muted)] uppercase">Time Scale</span>
          <span className="text-[11px] text-[var(--text)]">{w.timeScale.toFixed(1)}x</span>
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
          className="w-full accent-[var(--accent)]"
        />
      </div>
    </InspectorSection>
  )
}
