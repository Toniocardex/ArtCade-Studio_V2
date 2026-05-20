import { useCallback, useEffect } from 'react'
import { Box, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import PanelHeader from '../components/PanelHeader'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry, EntityDef } from '../types'
import { DEFAULT_WORLD } from '../types'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'
import { createEntityDef, nextEntityId } from '../utils/project'

const CLASS_COLOR: Record<string, string> = {
  Player:  'var(--accent)',
  Tilemap: 'var(--muted)',
  Slime:   'var(--green-2)',
  Enemy:   'var(--danger)',
}

let _hierarchyLogId = 800
function panelLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id: ++_hierarchyLogId,
    time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    message,
    level,
  }
}

function AddEntityButton({
  onClick,
  disabled,
  className = '',
  variant = 'solid',
}: {
  onClick: () => void
  disabled?: boolean
  className?: string
  variant?: 'solid' | 'dashed'
}) {
  const base =
    variant === 'dashed'
      ? 'border border-dashed border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent-bd)] bg-transparent'
      : 'border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Add entity to the current scene"
      title="Add entity to the current scene (Insert)"
      className={`flex items-center justify-center gap-1.5 rounded text-[10px] font-semibold
                  disabled:opacity-40 cursor-pointer ${base} ${className}`}
    >
      <Plus size={12} /> Add entity
    </button>
  )
}

function EntityRow({ entity, selected, onClick, onToggleVisible, onDuplicate, onDelete }: {
  entity:  EntityDef
  selected: boolean
  onClick:  () => void
  onToggleVisible: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const color = CLASS_COLOR[entity.className] ?? 'var(--muted)'
  const visible = entity.visible !== false
  const showRowActions = selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          title="Duplicate entity"
          className={`${showRowActions} ${
            selected ? 'text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--accent)]'
          }`}
        >
          <Copy size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Delete entity"
          className={`${showRowActions} text-[var(--muted)] hover:text-[var(--danger)]`}
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
  const { project, selection, mode } = state

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

  const addEntity = useCallback(() => {
    if (!scene) return
    const id = nextEntityId(project)
    const preview = createEntityDef(id)
    dispatch({ type: 'ENTITY_ADD', sceneId })
    dispatch({
      type: 'LOG',
      entry: panelLog(`Added ${preview.name} — rename in Inspector`, 'info'),
    })
  }, [scene, sceneId, project, dispatch])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (mode !== 'canvas') return
      const isInsert = e.key === 'Insert'
      const isAccel = e.ctrlKey && e.shiftKey && (e.key === 'N' || e.key === 'n')
      if (!isInsert && !isAccel) return
      if (shouldIgnoreEditorShortcut(e)) return
      if (!scene) return
      e.preventDefault()
      addEntity()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, scene, addEntity])

  return (
    <div className="h-full flex flex-col bg-[var(--panel)]">
      <PanelHeader title="Hierarchy">
        <AddEntityButton
          onClick={addEntity}
          disabled={!scene}
          className="px-2.5 py-1"
        />
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
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <p className="text-[11px] text-[var(--text)] font-medium">This scene is empty</p>
            <p className="text-[10px] text-[var(--muted)] leading-snug">
              Add an object to place it on the canvas. Use Insert or the button below.
            </p>
            <AddEntityButton
              onClick={addEntity}
              disabled={!scene}
              variant="dashed"
              className="w-full mt-1 px-3 py-2"
            />
          </div>
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
              onDuplicate={() => dispatch({ type: 'ENTITY_DUPLICATE', entityId: e.id, sceneId })}
              onDelete={() => dispatch({ type: 'ENTITY_DELETE', entityId: e.id })}
            />
          ))
        )}
      </div>

      <WorldSettingsSection />

      <div className="px-2 py-1 border-t border-[var(--border)] text-[9px] text-[var(--muted)]">
        {entities.length} entities · {scene?.name ?? '—'} · Insert to add
      </div>
    </div>
  )
}
