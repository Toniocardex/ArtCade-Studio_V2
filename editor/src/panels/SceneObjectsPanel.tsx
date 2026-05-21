// ---------------------------------------------------------------------------
// SceneObjectsPanel — left sidebar in canvas mode
// ---------------------------------------------------------------------------
//
// Two stacked sections plus a small World Settings block at the bottom:
//
//   1. Scenes ........ create / select / rename / set-start / delete the
//                      scenes that make up the project. Start scene is
//                      ProjectDoc.activeSceneId. Delete is blocked for the
//                      only remaining scene and for the start scene; the
//                      reducer also cleans orphan entities, thumbnails and
//                      logic boards.
//   2. Objects ....... entities of the currently selected scene; add /
//                      duplicate / visibility / delete / open Logic Board.
//
// Previously this file was called HierarchyPanel — renamed when scene
// management moved in. "Hierarchy" implied a parent/child tree, which is
// not what this UI is.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Copy, Eye, EyeOff, Plus, Star, Trash2, Workflow } from 'lucide-react'
import PanelHeader from '../components/PanelHeader'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry, EntityDef } from '../types'
import { DEFAULT_WORLD } from '../types'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'
import { createEntityDef, findLogicBoardForEntity, nextEntityId } from '../utils/project'

const CLASS_COLOR: Record<string, string> = {
  Player:  'var(--accent)',
  Tilemap: 'var(--muted)',
  Slime:   'var(--green-2)',
  Enemy:   'var(--danger)',
}

let _sceneObjectsLogId = 800
function panelLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id: ++_sceneObjectsLogId,
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

function AddSceneButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create scene"
      title="Create a new empty scene"
      className="flex items-center justify-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-semibold
                 border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                 hover:bg-[var(--accent-bg-h)] cursor-pointer"
    >
      <Plus size={12} /> Scene
    </button>
  )
}

function SectionLabel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <div className="text-[9px] text-[var(--muted)] uppercase font-bold tracking-widest">
        {title}
      </div>
      {children}
    </div>
  )
}

function EntityRow({ entity, selected, hasLogic, onClick, onEditLogic, onToggleVisible, onDuplicate, onDelete }: {
  entity:  EntityDef
  selected: boolean
  hasLogic: boolean
  onClick:  () => void
  onEditLogic: () => void
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
        {hasLogic && (
          <span
            title="Has Logic Board rulesheet"
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              selected ? 'bg-[var(--bg)]' : 'bg-[var(--accent)]'
            }`}
          />
        )}
      </button>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onEditLogic() }}
          title="Edit logic for this entity"
          className={`${showRowActions} ${
            selected ? 'text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--accent)]'
          }`}
        >
          <Workflow size={11} />
        </button>
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

export default function SceneObjectsPanel() {
  const { state, dispatch } = useEditor()
  const { project, selection, mode } = state
  const [sceneNameDraft, setSceneNameDraft] = useState('')

  const sceneId   = project ? selection.sceneId ?? project.activeSceneId : ''
  const scene     = project?.scenes[sceneId]
  const sceneCount = project ? Object.keys(project.scenes).length : 0
  const isStartScene = Boolean(project && sceneId === project.activeSceneId)
  const canDeleteScene = Boolean(scene && sceneCount > 1 && !isStartScene)
  const entities  = project ? (scene?.entityIds ?? [])
    .map(id => project.entities[id])
    .filter((e): e is EntityDef => Boolean(e))
    : []

  useEffect(() => {
    setSceneNameDraft(scene?.name ?? '')
  }, [scene?.id, scene?.name])

  const addScene = useCallback(() => {
    if (!project) return
    dispatch({ type: 'SCENE_ADD_EMPTY', sourceSceneId: sceneId })
  }, [dispatch, project, sceneId])

  const commitSceneName = useCallback(() => {
    if (!scene) return
    const name = sceneNameDraft.trim()
    if (!name || name === scene.name) {
      setSceneNameDraft(scene.name)
      return
    }
    dispatch({ type: 'SCENE_RENAME', sceneId: scene.id, name })
  }, [dispatch, scene, sceneNameDraft])

  const deleteScene = useCallback(() => {
    if (!scene || !canDeleteScene) return
    const ok = window.confirm(`Delete scene "${scene.name}" and its objects?`)
    if (!ok) return
    dispatch({ type: 'SCENE_DELETE', sceneId: scene.id })
  }, [canDeleteScene, dispatch, scene])

  const addEntity = useCallback(() => {
    if (!project || !scene) return
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

  if (!project) {
    return (
      <div className="h-full bg-[var(--panel)] flex items-center justify-center">
        <span className="text-[var(--muted)] text-xs">No project</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[var(--panel)]" data-panel="scene-objects">
      <PanelHeader title="Scenes">
        <AddSceneButton onClick={addScene} />
      </PanelHeader>

      {/* Scene management */}
      <div className="px-2 py-2 border-b border-[var(--border)] space-y-2">
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
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={sceneNameDraft}
            disabled={!scene}
            aria-label="Scene name"
            title="Scene name"
            onChange={e => setSceneNameDraft(e.target.value)}
            onBlur={commitSceneName}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setSceneNameDraft(scene?.name ?? '')
                e.currentTarget.blur()
              }
            }}
            className="min-w-0 flex-1 bg-[var(--border)] border border-[var(--border-2)] text-[var(--accent)]
                       text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[var(--accent)]"
          />
          <span
            title={isStartScene ? 'Start scene' : 'Not the start scene'}
            className={`flex items-center justify-center w-7 h-7 rounded border ${
              isStartScene
                ? 'border-[var(--accent-bd)] text-[var(--accent)] bg-[var(--accent-bg)]'
                : 'border-[var(--border-2)] text-[var(--muted)]'
            }`}
          >
            <Star size={12} fill={isStartScene ? 'currentColor' : 'none'} />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={!scene || isStartScene}
            onClick={() => scene && dispatch({ type: 'SCENE_SET_START', sceneId: scene.id })}
            title={isStartScene ? 'This is already the start scene' : 'Use this scene when the game starts'}
            className="rounded border border-[var(--border-2)] px-2 py-1 text-[10px] font-semibold
                       text-[var(--text)] hover:border-[var(--accent-bd)] hover:text-[var(--accent)]
                       disabled:opacity-40 disabled:hover:text-[var(--text)] disabled:hover:border-[var(--border-2)]"
          >
            Set Start
          </button>
          <button
            type="button"
            disabled={!canDeleteScene}
            onClick={deleteScene}
            title={
              isStartScene
                ? 'Start scene cannot be deleted'
                : sceneCount <= 1
                  ? 'Project must keep at least one scene'
                  : 'Delete this scene'
            }
            className="rounded border border-[var(--border-2)] px-2 py-1 text-[10px] font-semibold
                       text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]
                       disabled:opacity-40 disabled:hover:text-[var(--muted)] disabled:hover:border-[var(--border-2)]"
          >
            Delete
          </button>
        </div>
      </div>

      <SectionLabel title="Objects">
        <AddEntityButton
          onClick={addEntity}
          disabled={!scene}
          className="px-2 py-0.5"
        />
      </SectionLabel>

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
              hasLogic={Boolean(findLogicBoardForEntity(project, e.id))}
              onClick={() =>
                dispatch({ type: 'SELECT_ENTITY', entityId: selection.entityId === e.id ? null : e.id })
              }
              onEditLogic={() => {
                dispatch({ type: 'SELECT_ENTITY', entityId: e.id })
                dispatch({ type: 'SET_MODE', mode: 'logic' })
              }}
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
        {sceneCount} scenes · {entities.length} objects · {scene?.name ?? '-'}
      </div>
    </div>
  )
}
