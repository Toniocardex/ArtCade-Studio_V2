// ---------------------------------------------------------------------------
// SceneObjectsPanel — left sidebar in canvas mode
// ---------------------------------------------------------------------------
//
// Sidebar layout (canvas mode):
//
//   1. Scenes — scene list and lifecycle.
//   2. In this scene — entity instances in the active scene; "Add entity" for a
//      one-off placement (ENTITY_ADD). Primary workflow for new users.
//   3. Entity types — reusable ObjectTypeDef templates; "Place" spawns copies
//      (INSTANCE_ADD_FROM_TYPE). Collapsed in Base view until a type exists.
//
// Global world/physics settings live in Inspector → Scene tab.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Copy, Eye, EyeOff, Plus, Star, Trash2, Workflow } from 'lucide-react'
import PanelHeader from '../components/PanelHeader'
import { useEditor } from '../store/editor-store'
import type { ConsoleEntry, EntityDef } from '../types'
import {
  applyInputBackspace,
  isBackspaceKey,
  shouldIgnoreEditorShortcut,
} from '../utils/keyboard'
import { confirmDialog, promptTextInput } from '../utils/native-dialog'
import {
  allObjectTypeIds,
  createEntityDef,
  findLogicBoardForInstance,
  nextEntityId,
  objectTypeDisplayLabel,
} from '../utils/project'

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

function deleteSceneButtonTitle(isStartScene: boolean, sceneCount: number): string {
  if (isStartScene) return 'Start scene cannot be deleted'
  if (sceneCount <= 1) return 'Project must keep at least one scene'
  return 'Delete this scene'
}

type AddEntityButtonProps = Readonly<{
  onClick: () => void
  disabled?: boolean
  className?: string
  variant?: 'solid' | 'dashed'
}>

/** One-off scene entity (ENTITY_ADD) — not spawned from an entity type template. */
function AddEntityButton({
  onClick,
  disabled,
  className = '',
  variant = 'solid',
}: AddEntityButtonProps) {
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
      title="Place a one-off entity in this scene (Insert). Save the project to promote it to an entity type."
      className={`flex items-center justify-center gap-1.5 rounded text-[10px] font-semibold
                  disabled:opacity-40 cursor-pointer ${base} ${className}`}
    >
      <Plus size={12} /> Add entity
    </button>
  )
}

type AddSceneButtonProps = Readonly<{
  onClick: () => void
}>

function AddSceneButton({ onClick }: AddSceneButtonProps) {
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

type SectionLabelProps = Readonly<{
  title: string
  children?: ReactNode
}>

function SectionLabel({ title, children }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <div className="text-[9px] text-[var(--muted)] uppercase font-bold tracking-widest">
        {title}
      </div>
      {children}
    </div>
  )
}

type EntityRowProps = Readonly<{
  entity: EntityDef
  selected: boolean
  hasLogic: boolean
  onClick: () => void
  onEditLogic: () => void
  onToggleVisible: () => void
  onDuplicate: () => void
  onDelete: () => void
}>

function EntityRow({
  entity,
  selected,
  hasLogic,
  onClick,
  onEditLogic,
  onToggleVisible,
  onDuplicate,
  onDelete,
}: EntityRowProps) {
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

export default function SceneObjectsPanel() {
  const { state, dispatch } = useEditor()
  const { project, selection, mode, authoringMode } = state
  const [sceneNameDraft, setSceneNameDraft] = useState('')

  const sceneId   = project ? selection.sceneId ?? project.activeSceneId : ''
  const scene     = project?.scenes[sceneId]
  const sceneCount = project ? Object.keys(project.scenes).length : 0
  const isStartScene = sceneId === project?.activeSceneId
  const canDeleteScene = Boolean(scene && sceneCount > 1 && !isStartScene)
  const entities  = project ? (scene?.entityIds ?? [])
    .map(id => project.entities[id])
    .filter((e): e is EntityDef => Boolean(e))
    : []
  const entityTypeIds = project ? allObjectTypeIds(project) : []
  const [entityTypesOpen, setEntityTypesOpen] = useState(false)

  useEffect(() => {
    setSceneNameDraft(scene?.name ?? '')
  }, [scene?.id, scene?.name])

  useEffect(() => {
    if (!project) {
      setEntityTypesOpen(false)
      return
    }
    if (authoringMode === 'advanced' || entityTypeIds.length > 0) {
      setEntityTypesOpen(true)
    }
  }, [project, authoringMode, entityTypeIds.length])

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
    void confirmDialog(`Delete scene "${scene.name}" and its entities?`, {
      title: 'Delete scene',
      kind: 'warning',
    }).then((ok) => {
      if (ok) dispatch({ type: 'SCENE_DELETE', sceneId: scene.id })
    })
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

  const addEntityType = useCallback(() => {
    void promptTextInput({
      title: 'New entity type',
      message: 'Type name (reusable template for many entity copies):',
      defaultValue: 'Entity',
    }).then((name) => {
      if (!name) return
      dispatch({ type: 'OBJECT_TYPE_ADD', displayName: name })
    })
  }, [dispatch])

  const placeEntityType = useCallback(
    (objectTypeId: string) => {
      if (!scene) return
      dispatch({ type: 'INSTANCE_ADD_FROM_TYPE', sceneId, objectTypeId })
      dispatch({
        type: 'LOG',
        entry: panelLog(
          `Placed ${objectTypeDisplayLabel(project!, objectTypeId)} in scene`,
          'info',
        ),
      })
    },
    [dispatch, project, scene, sceneId],
  )

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
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [mode, scene, addEntity])

  if (!project) {
    return (
      <div className="h-full bg-[var(--panel)] flex items-center justify-center">
        <span className="text-[var(--muted)] text-xs">No project</span>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--panel)]" data-panel="scene-objects">
      <PanelHeader title="Scenes">
        <AddSceneButton onClick={addScene} />
      </PanelHeader>

      {/* Scene management */}
      <div className="px-2 py-2 border-b border-[var(--border)] space-y-2">
        <select
          value={sceneId}
          onChange={e => dispatch({ type: 'SELECT_SCENE', sceneId: e.target.value })}
          className="w-full bg-[var(--panel-3)] border border-[var(--border-2)] text-[var(--text)]
                     text-[11px] rounded px-2 py-0.5 focus:outline-none
                     focus:border-[var(--accent-2)] transition-colors"
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
              e.stopPropagation()
              // WebView2 often swallows native Backspace in <input>; mirror Inspector.
              if (isBackspaceKey(e)) {
                e.preventDefault()
                applyInputBackspace(e.currentTarget)
                return
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setSceneNameDraft(scene?.name ?? '')
                e.currentTarget.blur()
              }
            }}
            className="min-w-0 flex-1 bg-[var(--panel-3)] border border-[var(--border-2)] text-[var(--text)]
                       text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[var(--accent-2)] transition-colors"
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
            title={deleteSceneButtonTitle(isStartScene, sceneCount)}
            className="rounded border border-[var(--border-2)] px-2 py-1 text-[10px] font-semibold
                       text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]
                       disabled:opacity-40 disabled:hover:text-[var(--muted)] disabled:hover:border-[var(--border-2)]"
          >
            Delete
          </button>
        </div>
      </div>

      <SectionLabel title="Entities">
        <AddEntityButton
          onClick={addEntity}
          disabled={!scene}
          className="px-2 py-0.5"
        />
      </SectionLabel>
      <p className="px-2 pb-1.5 text-[9px] text-[var(--muted)] leading-snug border-b border-[var(--border)]">
        Add entity = one placement. Use entity types below for copies and Logic Board rules on a type.
      </p>

      {/* Entity list */}
      <div className="panel-scroll flex-1 min-h-0 p-1 pe-0.5 space-y-0.5">
        {entities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
            <p className="text-[11px] text-[var(--text)] font-medium">This scene is empty</p>
            <p className="text-[10px] text-[var(--muted)] leading-snug">
              Start with Add entity, or open Entity types and Place a copy.
            </p>
            <AddEntityButton
              onClick={addEntity}
              disabled={!scene}
              className="mt-1 px-2 py-0.5"
            />
          </div>
        ) : (
          entities.map(e => (
            <EntityRow
              key={e.id}
              entity={e}
              selected={selection.entityId === e.id}
              hasLogic={Boolean(findLogicBoardForInstance(project, e.id))}
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

      <details
        className="border-t border-[var(--border)] flex-shrink-0"
        open={entityTypesOpen}
        onToggle={(e) => setEntityTypesOpen(e.currentTarget.open)}
      >
        <summary
          className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer
                     list-none [&::-webkit-details-marker]:hidden"
        >
          <span className="text-[9px] text-[var(--muted)] uppercase font-bold tracking-widest">
            Entity types
            {entityTypeIds.length > 0 && (
              <span className="ml-1 font-normal normal-case tracking-normal text-[var(--text)]">
                ({entityTypeIds.length})
              </span>
            )}
          </span>
          <button
            type="button"
            disabled={!project}
            onClick={(e) => {
              e.preventDefault()
              addEntityType()
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold
                       border border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--accent)]"
          >
            <Plus size={12} /> New
          </button>
        </summary>
        <div className="px-2 pb-2 space-y-1 max-h-32 overflow-y-auto">
          {entityTypeIds.length === 0 ? (
            <p className="text-[10px] text-[var(--muted)] px-1 leading-snug">
              Reusable templates for many entity copies and Logic Board targets by type.
              Saving the project can promote entities into types, or create one with New.
            </p>
          ) : (
            entityTypeIds.map((typeId) => (
              <div
                key={typeId}
                className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--panel-3)] px-1.5 py-1"
              >
                <span className="flex-1 text-[10px] text-[var(--text)] truncate" title={typeId}>
                  {objectTypeDisplayLabel(project, typeId)}
                </span>
                <button
                  type="button"
                  disabled={!scene}
                  title={`Place a copy of ${objectTypeDisplayLabel(project, typeId)} in this scene`}
                  onClick={() => placeEntityType(typeId)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold
                             border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                             hover:bg-[var(--accent-bg-h)] disabled:opacity-40"
                >
                  <Plus size={10} /> Place
                </button>
              </div>
            ))
          )}
        </div>
      </details>

      <div className="px-2 py-1 border-t border-[var(--border)] text-[9px] text-[var(--muted)] flex-shrink-0">
        {sceneCount} scenes · {entities.length} entities · {entityTypeIds.length} types
      </div>
    </div>
  )
}
