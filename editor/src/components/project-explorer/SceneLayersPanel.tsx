import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, Plus, Trash2, Unlock } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { DEFAULT_LAYERS, layerLocked, layerVisible, sceneLayerSettings } from '../../constants/scene-layers'
import { editorRowSelected } from '../ui/editor-ui-classes'
import { handleControlledInputKeyDown } from '../../utils/keyboard'
import { ExplorerRowAction } from './explorer-cta'
import { ExplorerEmptyState } from './ExplorerEmptyState'

export function SceneLayersPanel() {
  const dispatch = useEditorDispatch()
  const layers = useEditorSelector((s) => s.project?.layers ?? DEFAULT_LAYERS)
  const selectedLayerId = useEditorSelector((s) => s.inspectorLayerId)
  const sceneId = useEditorSelector((s) => s.selection.sceneId ?? s.project?.activeSceneId ?? null)
  const scene = useEditorSelector((s) => (sceneId ? s.project?.scenes?.[sceneId] : undefined))
  const [addingName, setAddingName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (renamingId) renameInputRef.current?.select()
  }, [renamingId])

  function handleAdd() {
    const name = addingName.trim()
    if (!name) return
    dispatch({ type: 'LAYER_ADD', name })
    setAddingName('')
    addInputRef.current?.focus()
  }

  function startRename(id: string, name: string) {
    setRenamingId(id)
    setRenameValue(name)
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      dispatch({ type: 'LAYER_RENAME', layerId: renamingId, name: renameValue.trim() })
    }
    setRenamingId(null)
  }

  return (
    <div className="h-full flex flex-col text-[10px] overflow-hidden bg-[var(--panel)]">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--panel-2)] shrink-0">
        <input
          ref={addInputRef}
          className="flex-1 min-w-0 bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] placeholder:text-[var(--muted)] px-2 py-1 rounded text-[10px] focus:outline-none focus:border-[var(--accent)]"
          placeholder="New layer name..."
          value={addingName}
          onChange={(e) => setAddingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
            handleControlledInputKeyDown(e, setAddingName)
          }}
        />
        <ExplorerRowAction
          title="Add layer (Enter)"
          disabled={!addingName.trim()}
          tone="accent"
          onClick={(ev) => {
            ev.stopPropagation()
            handleAdd()
          }}
        >
          <Plus size={13} />
        </ExplorerRowAction>
      </div>

      <div className="flex-1 overflow-auto px-1 py-1">
        {layers.length === 0 ? (
          <ExplorerEmptyState title="No layers" detail="Add a layer to organize scene rendering." />
        ) : (
          layers.map((layer, idx) => {
            const active = selectedLayerId === layer.id
            const renderOrder = layers.length - idx
            const isRenaming = renamingId === layer.id
            const visible = layerVisible(sceneLayerSettings(scene, layer.id))
            const locked = layerLocked(layer)
            const actionTone = active ? 'onSelected' : 'default'

            return (
              <div
                key={layer.id}
                className={`group/explorer-row flex items-center gap-1 rounded py-1 pl-2 pr-1 ${
                  active ? editorRowSelected : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div
                  role={isRenaming ? undefined : 'button'}
                  tabIndex={isRenaming ? undefined : 0}
                  className="flex min-w-0 flex-1 items-center gap-1 text-left"
                  onClick={() => {
                    if (isRenaming) return
                    const selecting = !active
                    dispatch({ type: 'SELECT_INSPECTOR_LAYER', layerId: selecting ? layer.id : null })
                    if (selecting) dispatch({ type: 'SET_EDITOR_ACTIVE_LAYER', layerId: layer.id })
                  }}
                  onDoubleClick={() => startRename(layer.id, layer.name)}
                  onKeyDown={(e) => {
                    if (isRenaming || (e.key !== 'Enter' && e.key !== ' ')) return
                    e.preventDefault()
                    const selecting = !active
                    dispatch({ type: 'SELECT_INSPECTOR_LAYER', layerId: selecting ? layer.id : null })
                    if (selecting) dispatch({ type: 'SET_EDITOR_ACTIVE_LAYER', layerId: layer.id })
                  }}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      className="w-full bg-[var(--surface-3)] border border-[var(--outline)] text-[var(--text)] px-1 py-0.5 rounded text-[10px]"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitRename()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setRenamingId(null)
                        }
                        handleControlledInputKeyDown(e, setRenameValue)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate">{layer.name}</span>
                  )}
                  <span className="ml-auto shrink-0 rounded border border-[var(--border)] px-1 py-0.5 font-mono text-[8px] text-[var(--muted)]">
                    {renderOrder}
                  </span>
                </div>
                <div
                  className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
                    active
                      ? 'opacity-100'
                      : 'opacity-0 group-hover/explorer-row:opacity-100 group-focus-within/explorer-row:opacity-100'
                  }`}
                >
                  <ExplorerRowAction
                    disabled={!sceneId}
                    title={visible ? `Hide "${layer.name}"` : `Show "${layer.name}"`}
                    tone={actionTone}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      if (!sceneId) return
                      dispatch({
                        type: 'SCENE_LAYER_SETTINGS_UPDATE',
                        sceneId,
                        layerId: layer.id,
                        patch: { visible: !visible },
                      })
                    }}
                  >
                    {visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </ExplorerRowAction>
                  <ExplorerRowAction
                    title={locked ? `Unlock "${layer.name}"` : `Lock "${layer.name}"`}
                    tone={actionTone}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      dispatch({
                        type: 'LAYER_SET_LOCKED',
                        layerId: layer.id,
                        locked: !locked,
                      })
                    }}
                  >
                    {locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </ExplorerRowAction>
                  <ExplorerRowAction
                    title="Move up (higher priority)"
                    disabled={idx === 0}
                    tone={actionTone}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      dispatch({ type: 'LAYER_MOVE', layerId: layer.id, direction: 'up' })
                    }}
                  >
                    <ChevronUp size={13} />
                  </ExplorerRowAction>
                  <ExplorerRowAction
                    title="Move down (lower priority)"
                    disabled={idx === layers.length - 1}
                    tone={actionTone}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      dispatch({ type: 'LAYER_MOVE', layerId: layer.id, direction: 'down' })
                    }}
                  >
                    <ChevronDown size={13} />
                  </ExplorerRowAction>
                  <ExplorerRowAction
                    title={layers.length <= 1 ? 'Cannot delete the last layer' : `Delete "${layer.name}"`}
                    disabled={layers.length <= 1}
                    tone={active ? 'onSelected' : 'danger'}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      dispatch({ type: 'LAYER_DELETE', layerId: layer.id })
                    }}
                  >
                    <Trash2 size={12} />
                  </ExplorerRowAction>
                </div>
              </div>
            )
          })
        )}
        <p className="px-2 pt-2 pb-1 text-[9px] text-[var(--muted)] leading-relaxed">
          Top row = highest render priority. Double-click a name to rename.
        </p>
      </div>
    </div>
  )
}
