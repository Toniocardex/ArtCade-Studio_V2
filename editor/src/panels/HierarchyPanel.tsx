import { Box, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import PanelHeader from '../components/PanelHeader'
import { useEditor } from '../store/editor-store'
import type { EntityDef } from '../types'
import { DEFAULT_WORLD } from '../types'

const CLASS_COLOR: Record<string, string> = {
  Player:  'var(--accent)',
  Tilemap: 'var(--muted)',
  Slime:   'var(--green-2)',
  Enemy:   'var(--danger)',
}

function EntityRow({ entity, selected, onClick, onToggleVisible, onDelete }: {
  entity:  EntityDef
  selected: boolean
  onClick:  () => void
  onToggleVisible: () => void
  onDelete: () => void
}) {
  const color = CLASS_COLOR[entity.className] ?? 'var(--muted)'
  const visible = entity.visible !== false
  return (
    <div
      className={`group w-full flex items-center justify-between px-2 py-1.5
                  rounded text-xs cursor-pointer transition-all ${
                    selected
                      ? 'bg-[var(--accent)] text-[var(--bg)] font-bold'
                      : 'hover:bg-[var(--border)] text-[var(--text)]'
                  } ${visible ? '' : 'opacity-40'}`}
    >
      <button onClick={onClick} className="flex items-center gap-2 min-w-0 flex-1 text-left">
        <Box size={12} style={{ color: selected ? 'var(--bg)' : color, flexShrink: 0 }} />
        <span className="truncate">{entity.name}</span>
      </button>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisible() }}
          title={visible ? 'Hide' : 'Show'}
          className={selected ? 'text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}
        >
          {visible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Delete entity"
          className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--danger)]"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function WorldSettingsSection() {
  const { state, dispatch } = useEditor()
  const w = { ...DEFAULT_WORLD, ...state.project?.world }

  const num = (label: string, key: keyof typeof w, step: number) => (
    <div className="flex items-center justify-between gap-2">
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
    <div className="px-3 py-3 border-t border-[var(--border)] space-y-2">
      <div className="text-[9px] text-[var(--muted)] uppercase font-bold tracking-widest">
        World Settings
      </div>
      {num('Gravity (m/s²)', 'gravity', 0.1)}
      {num('Px / Meter', 'pixelsPerMeter', 1)}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-[var(--muted)] uppercase">Time Scale</span>
          <span className="text-[11px] text-[var(--accent-2)]">{w.timeScale.toFixed(1)}x</span>
        </div>
        <input
          type="range" min={0} max={2} step={0.1}
          value={w.timeScale}
          onChange={(e) =>
            dispatch({ type: 'WORLD_SET', patch: { timeScale: Number(e.target.value) } })
          }
          className="w-full accent-[var(--accent-2)]"
        />
      </div>
    </div>
  )
}

export default function HierarchyPanel() {
  const { state, dispatch } = useEditor()
  const { project, selection } = state

  if (!project) {
    return (
      <div className="h-full bg-[var(--panel)] flex items-center justify-center">
        <span className="text-[var(--muted)] text-xs">No project</span>
      </div>
    )
  }

  const sceneId   = selection.sceneId ?? project.activeSceneId
  const scene     = project.scenes[sceneId]
  const entities  = (scene?.entityIds ?? [])
    .map(id => project.entities[id])
    .filter((e): e is EntityDef => Boolean(e))

  return (
    <div className="h-full flex flex-col bg-[var(--panel)]">
      <PanelHeader title="Hierarchy">
        <button
          onClick={() => scene && dispatch({ type: 'ENTITY_ADD', sceneId })}
          title="Add entity"
          disabled={!scene}
          className="text-[var(--accent)] cursor-pointer hover:opacity-70 disabled:opacity-30"
        >
          <Plus size={13} />
        </button>
      </PanelHeader>

      {/* Scene selector */}
      <div className="px-2 py-1.5 border-b border-[var(--border)]">
        <select
          value={sceneId}
          onChange={e => dispatch({ type: 'SELECT_SCENE', sceneId: e.target.value })}
          className="w-full bg-[var(--border)] border border-[var(--border-2)] text-[var(--text)]
                     text-[11px] rounded px-2 py-0.5 focus:outline-none
                     focus:border-[var(--accent)]"
        >
          {Object.values(project.scenes).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {entities.length === 0 ? (
          <p className="text-[var(--muted)] text-[10px] px-2 pt-2">No entities.</p>
        ) : (
          entities.map(e => (
            <EntityRow
              key={e.id}
              entity={e}
              selected={selection.entityId === e.id}
              onClick={() =>
                dispatch({ type: 'SELECT_ENTITY', entityId: selection.entityId === e.id ? null : e.id })
              }
              onToggleVisible={() =>
                dispatch({ type: 'ENTITY_SET_VISIBLE', entityId: e.id, visible: e.visible === false })
              }
              onDelete={() => dispatch({ type: 'ENTITY_DELETE', entityId: e.id })}
            />
          ))
        )}
      </div>

      {/* World settings (mockup: left sidebar) */}
      <WorldSettingsSection />

      {/* Footer */}
      <div className="px-2 py-1 border-t border-[var(--border)] text-[9px] text-[var(--muted)]">
        {entities.length} entities · {scene?.name ?? '—'}
      </div>
    </div>
  )
}
